import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (resolve(git('rev-parse', '--show-toplevel')).toLowerCase() !== root.toLowerCase()) {
  throw new Error('请在房车自己的 Git 仓库安装 hook，不能修改父库配置。');
}
let current = '';
try {
  current = git('config', '--get', 'core.hooksPath');
} catch (error) {
  if ((error as { status?: number }).status !== 1) throw error;
}
if (current && current !== '.githooks') {
  throw new Error(
    `已有 core.hooksPath=${current}；请把 bun run scripts/sync-types.ts --hook 合入原 pre-commit，未覆盖配置。`,
  );
}
if (!current && existsSync(resolve(root, git('rev-parse', '--git-path', 'hooks/pre-commit')))) {
  throw new Error('已有默认 pre-commit；请把 bun run scripts/sync-types.ts --hook 合入原 hook，未覆盖配置。');
}
git('config', '--local', 'core.hooksPath', '.githooks');
console.log('已安装本库 pre-commit：同步公开声明，不自动运行类型检查。');
