import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const temporary: string[] = [];
async function removeTemporary(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await removeTemporary(path);
    else await chmod(path, 0o666);
  }
  await rm(directory, { recursive: true, force: true });
}
afterEach(async () => {
  for (const directory of temporary.splice(0)) await removeTemporary(directory);
});
const git = (directory: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();

async function setup() {
  await mkdir(join(root, '.test-data/card-rv/tools'), { recursive: true });
  const directory = await mkdtemp(join(root, '.test-data/card-rv/tools/types-'));
  temporary.push(directory);
  const repo = join(directory, 'card/房车');
  const source = join(directory, 'release/st-sqlite-helper/types');
  await mkdir(join(repo, 'scripts'), { recursive: true });
  await mkdir(source, { recursive: true });
  await copyFile(join(root, 'scripts/sync-types.ts'), join(repo, 'scripts/sync-types.ts'));
  await copyFile(join(root, 'scripts/install-hooks.ts'), join(repo, 'scripts/install-hooks.ts'));
  git(repo, 'init', '-b', 'main');
  await writeFile(join(source, '../manifest.json'), JSON.stringify({ version: '0.3.0' }));
  await writeFile(join(source, 'dvs.d.ts'), 'export interface Dvs {}\n');
  await writeFile(join(source, 'sqlite-helper.d.ts'), 'export interface Helper {}\n');
  return { repo, source };
}

async function run(repo: string, script: string, ...args: string[]) {
  const child = Bun.spawn([process.execPath, join(repo, 'scripts', script), ...args], {
    cwd: repo,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

test('hook prints source/version and synchronizes only declarations including removals', async () => {
  const { repo, source } = await setup();
  const target = join(repo, 'types/sqlite-helper');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'old.d.ts'), 'old');
  await writeFile(join(target, 'dvs.d.ts'), 'old');
  await writeFile(join(target, 'README.md'), 'keep');
  await writeFile(join(repo, 'unrelated.txt'), 'do not stage');
  const result = await run(repo, 'sync-types.ts', '--hook');
  expect(result.code).toBe(0);
  expect(result.stdout).toContain(source);
  expect(result.stdout).toContain('来源版本：0.3.0');
  expect(result.stdout).toContain('修改 dvs.d.ts');
  expect(result.stdout).toContain('新增 sqlite-helper.d.ts');
  expect(result.stdout).toContain('删除 old.d.ts');
  expect(await Bun.file(join(target, 'old.d.ts')).exists()).toBe(false);
  expect(await readFile(join(target, 'dvs.d.ts'), 'utf8')).toBe('export interface Dvs {}\n');
  expect(await readFile(join(target, 'README.md'), 'utf8')).toBe('keep');
  expect(git(repo, 'diff', '--cached', '--name-only')).not.toContain('unrelated.txt');
  expect((await run(repo, 'sync-types.ts', '--hook')).stdout).toContain('没有变化');
});

test('standalone hook preserves committed copies while explicit missing source fails', async () => {
  const { repo, source } = await setup();
  expect((await run(repo, 'sync-types.ts', '--hook')).code).toBe(0);
  await rm(source, { recursive: true });
  const result = await run(repo, 'sync-types.ts', '--hook');
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('本次未刷新');
  expect(await Bun.file(join(repo, 'types/sqlite-helper/dvs.d.ts')).exists()).toBe(true);
  expect((await run(repo, 'sync-types.ts', source)).code).not.toBe(0);
});

test('invalid or unwritable sources fail without staging unrelated files', async () => {
  const { repo, source } = await setup();
  await rm(join(source, 'dvs.d.ts'));
  expect((await run(repo, 'sync-types.ts', '--hook')).code).not.toBe(0);
  expect(git(repo, 'diff', '--cached', '--name-only')).toBe('');
  await writeFile(join(source, 'dvs.d.ts'), 'export {};');
  await mkdir(join(repo, 'types'), { recursive: true });
  await writeFile(join(repo, 'types/sqlite-helper'), 'blocks target directory');
  expect((await run(repo, 'sync-types.ts', '--hook')).code).not.toBe(0);
  expect(git(repo, 'diff', '--cached', '--name-only')).toBe('');
});

test('hook installer preserves existing custom and default hooks', async () => {
  const { repo } = await setup();
  git(repo, 'config', '--local', 'core.hooksPath', 'custom-hooks');
  expect((await run(repo, 'install-hooks.ts')).code).not.toBe(0);
  expect(git(repo, 'config', '--get', 'core.hooksPath')).toBe('custom-hooks');
  git(repo, 'config', '--unset', 'core.hooksPath');
  const existing = join(repo, '.git/hooks/pre-commit');
  await writeFile(existing, '#!/bin/sh\nexit 0\n');
  expect((await run(repo, 'install-hooks.ts')).code).not.toBe(0);
  expect(await readFile(existing, 'utf8')).toContain('exit 0');
  await rm(existing);
  expect((await run(repo, 'install-hooks.ts')).code).toBe(0);
  expect(git(repo, 'config', '--local', '--get', 'core.hooksPath')).toBe('.githooks');
});
