import { join } from 'node:path';
import { compileTailwindCss } from './tailwind-compile';

const root = join(import.meta.dir, '..');
export const tailwindEntry = '状态栏/tailwind.css';
const sourceDir = join(root, '状态栏');

/**
 * Tailwind 4 把内部变量的默认值同时写成 @property 和 `@layer properties` 里的回退值，
 * 回退值外面包着只对旧 Safari／Firefox 生效的 @supports。ShadowRoot 内的 @property 不生效，
 * 在 Chromium 里就只剩被条件挡住的回退值，边框样式、位移等变量没有初值。
 * 这里把回退值展开为无条件规则；找不到预期结构说明 Tailwind 的输出变了，必须让构建失败。
 */
export function unwrapPropertiesSupports(css: string): string {
  const open = '@layer properties{@supports';
  const start = css.indexOf(open);
  if (start < 0)
    throw new Error('Tailwind 输出中没有 `@layer properties` 外层的 @supports，无法展开；请核对 Tailwind 版本与输出');
  const conditionEnd = css.indexOf('{', start + open.length);
  if (conditionEnd < 0) throw new Error('Tailwind `@layer properties` 的 @supports 缺少规则块');
  let depth = 1,
    i = conditionEnd + 1;
  for (; i < css.length && depth > 0; i++) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
  if (depth !== 0 || css[i] !== '}') throw new Error('Tailwind `@layer properties` 的 @supports 块没有按预期闭合');
  const body = css.slice(conditionEnd + 1, i - 1);
  if (!body.includes('--tw-')) throw new Error('Tailwind `@layer properties` 回退值中没有 --tw- 变量');
  const result = css.slice(0, start) + '@layer properties{' + body + '}' + css.slice(i + 1);
  if (/@layer properties\{@supports/.test(result))
    throw new Error('Tailwind 输出含多处 `@layer properties` 的 @supports，展开不完整');
  return result;
}

/** 扫描状态栏源码中的类名（可追加测试用类名），编译、压缩并展开回退值；`unwrap: false` 只供测试取得未处理的对照输出。 */
export async function compileTailwind(
  extraCandidates: string[] = [],
  unwrap = true,
): Promise<{ css: string; dependencies: string[] }> {
  const { css, dependencies } = await compileTailwindCss({
    entry: join(root, tailwindEntry),
    sourceDir,
    pattern: '**/*.{vue,ts}',
    extraCandidates,
  });
  return { css: unwrap ? unwrapPropertiesSupports(css) : css, dependencies };
}
