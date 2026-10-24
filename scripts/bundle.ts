import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';

const root = resolve(import.meta.dir, '..');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && (!args[0]!.trim() || args[0]!.startsWith('-')))) {
  throw new Error('用法：bun run build [版本号]');
}

if (args.length === 1) {
  const cardVersion = args[0]!;
  const indexPath = resolve(root, 'index.yaml');
  const source = await readFile(indexPath, 'utf8');
  const document = parseDocument(source);
  if (document.errors.length) throw new AggregateError(document.errors, '房车 index.yaml 解析失败');
  const entries = document.get('条目');
  if (!isSeq(entries)) throw new Error('房车 index.yaml 缺少条目列表');
  const versionEntries = entries.items.filter(entry => isMap(entry) && entry.get('名称') === '[DVS_VERSION]');
  if (versionEntries.length !== 1 || !isMap(versionEntries[0])) {
    throw new Error('房车 index.yaml 必须有且仅有一个 [DVS_VERSION] 条目');
  }
  const fields = [document.get('版本', true), versionEntries[0].get('内容', true)];
  const ranges = fields.map(field => {
    if (!isScalar(field) || !field.range) throw new Error('房车版本和 [DVS_VERSION] 内容必须是直接填写的值');
    return field.range;
  });
  // 只替换两个值，保留作者的注释、排版及其他未提交修改。
  let updated = source;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) {
    updated = updated.slice(0, start) + JSON.stringify(cardVersion) + updated.slice(end);
  }
  await writeFile(indexPath, updated);
  console.log(`房车卡片版本与 [DVS_VERSION] 已更新为 ${cardVersion}`);
}

for (const command of [
  ['run', 'scripts/build.ts', '--publish'],
  ['run', 'tavern_sync.mjs', 'bundle', '房车'],
]) {
  const child = Bun.spawn([process.execPath, ...command], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
  const exitCode = await child.exited;
  if (exitCode !== 0) process.exit(exitCode);
}
