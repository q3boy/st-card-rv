import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const target = join(root, 'types/sqlite-helper');

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function declarations(directory: string, prefix = ''): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  if (!(await exists(directory))) return result;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`声明目录不接受符号链接：${join(directory, entry.name)}`);
    if (entry.isDirectory()) {
      for (const [key, value] of await declarations(join(directory, entry.name), name + '/')) result.set(key, value);
    } else if (entry.isFile() && name.endsWith('.d.ts')) {
      result.set(name, await readFile(join(directory, entry.name)));
    }
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const hook = args[0] === '--hook';
  if (args.length > 1 || (args[0]?.startsWith('--') && !hook)) {
    throw new Error('用法：bun run types:sync [声明目录]；pre-commit 使用 --hook');
  }
  const explicit = hook ? undefined : args[0];
  const source = explicit ? resolve(process.cwd(), explicit) : resolve(root, '../../release/st-sqlite-helper/types');
  if (!(await exists(source))) {
    if (hook) {
      console.log('未找到父库发布声明，本次未刷新，使用已提交的声明副本。');
      return;
    }
    throw new Error(`声明来源不存在：${source}`);
  }
  if (resolve(source) === resolve(target)) throw new Error('声明来源不能是目标目录自身');
  // 先完整读取来源；读取失败时不改目标。后续写入或暂存失败会中止提交。
  const incoming = await declarations(source);
  for (const entry of ['dvs.d.ts', 'sqlite-helper.d.ts']) {
    if (!incoming.has(entry)) throw new Error(`声明来源缺少公开入口：${entry}`);
  }
  const current = await declarations(target);
  const changes = [...incoming.keys()]
    .sort()
    .filter(name => !current.get(name)?.equals(incoming.get(name)!))
    .map(name => ({ name, action: current.has(name) ? '修改' : '新增' }));
  const removed = [...current.keys()].filter(name => !incoming.has(name)).sort();
  if (!changes.length && !removed.length) {
    console.log('公开声明没有变化。');
    return;
  }
  const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
  if (resolve(gitRoot).toLowerCase() !== root.toLowerCase()) {
    throw new Error('请先在房车根目录建立自己的 Git 仓库，避免暂存到父库。');
  }
  const manifestPath = resolve(source, '../manifest.json');
  const version = (await exists(manifestPath))
    ? String((JSON.parse(await readFile(manifestPath, 'utf8')) as { version?: string }).version ?? '未知')
    : '未知';
  console.log(`声明来源：${source}\n来源版本：${version}`);
  for (const change of changes) console.log(`${change.action} ${change.name}`);
  for (const name of removed) console.log(`删除 ${name}`);
  for (const { name } of changes) {
    const path = join(target, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, incoming.get(name)!);
  }
  for (const name of removed) await rm(join(target, name));
  execFileSync('git', ['add', '--', 'types/sqlite-helper'], { cwd: root, stdio: 'inherit' });
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`公开声明同步失败：${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
