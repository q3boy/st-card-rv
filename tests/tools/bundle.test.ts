import { expect, test } from 'bun:test';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const cardRoot = resolve(import.meta.dir, '../..');

async function bundleProject(source: string) {
  const base = resolve(cardRoot, '.test-data/card-rv/tools');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, 'bundle-'));
  await mkdir(join(root, 'scripts'));
  await copyFile(join(cardRoot, 'scripts/bundle.ts'), join(root, 'scripts/bundle.ts'));
  await writeFile(join(root, 'index.yaml'), source);
  const recordCommand = `
    import { appendFile } from 'node:fs/promises';
    await appendFile('commands.jsonl', JSON.stringify(process.argv.slice(1)) + '\\n');
  `;
  await writeFile(join(root, 'scripts/build.ts'), recordCommand);
  await writeFile(join(root, 'tavern_sync.mjs'), recordCommand);
  return root;
}

async function runBundle(root: string, version: string) {
  const child = Bun.spawn([process.execPath, 'run', 'scripts/bundle.ts', version], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

test('传入版本更新唯一新版版本条目并保留其余 YAML，随后按顺序构建和打包', async () => {
  const source = `# 作者注释
版本: '0.1.0' # 卡片版本
自定义: { 保留: '排版与内容' }
条目:
  - 名称: '[DVS:版本]'
    内容: '0.1.0' # 世界书版本
  - 名称: '[DVS:正文]版本说明'
    内容: |
      文中出现 [DVS:版本] 不应被修改。
      0.1.0 也不是版本字段。
`;
  const version = '0.2.0 "旅行"';
  const root = await bundleProject(source);
  try {
    const result = await runBundle(root, version);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(await Bun.file(join(root, 'index.yaml')).text()).toBe(source.replaceAll("'0.1.0'", JSON.stringify(version)));
    const commands = (await Bun.file(join(root, 'commands.jsonl')).text())
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as string[]);
    expect(commands.map(command => [command[0]!.replaceAll('\\', '/').split('/').at(-1), ...command.slice(1)])).toEqual(
      [
        ['build.ts', '--publish'],
        ['tavern_sync.mjs', 'bundle', '房车'],
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const [condition, entries] of [
  ['没有新版版本条目', "  - 名称: '[DVS:正文]'\n    内容: '保持原样'"],
  ['存在两个新版版本条目', "  - 名称: '[DVS:版本]'\n    内容: '0.1.0'\n  - 名称: '[DVS:版本]'\n    内容: '0.1.0'"],
] as const) {
  test(`传入版本但${condition}时拒绝修改且不执行构建或打包`, async () => {
    const source = `版本: '0.1.0'\n条目:\n${entries}\n`;
    const root = await bundleProject(source);
    try {
      const result = await runBundle(root, '0.2.0');
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('必须有且仅有一个 [DVS:版本] 条目');
      expect(await Bun.file(join(root, 'index.yaml')).text()).toBe(source);
      expect(await Bun.file(join(root, 'commands.jsonl')).exists()).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
