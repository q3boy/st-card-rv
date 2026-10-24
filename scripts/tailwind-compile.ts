import { compile, optimize } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

export interface TailwindCompileOptions {
  /** 入口 CSS 文件的绝对路径；`@import` 相对它所在目录解析。 */
  entry: string;
  /** 接在入口文件内容之前的 CSS，用于补 Tailwind 的导入。 */
  prefixSource?: string;
  /** 扫描类名的根目录；`@import` 相对入口所在目录解析。 */
  sourceDir: string;
  /** 扫描文件的 glob，默认 `**\/*.{vue,ts}`。 */
  pattern?: string;
  /** 额外的类名候选（测试探针用）。 */
  extraCandidates?: string[];
}

/** 扫描源码中的类名，用 `@tailwindcss/node` 编译并压缩入口 CSS。 */
export async function compileTailwindCss(
  options: TailwindCompileOptions,
): Promise<{ css: string; dependencies: string[] }> {
  const dependencies: string[] = [];
  const compiler = await compile((options.prefixSource ?? '') + (await Bun.file(options.entry).text()), {
    base: options.entry.replace(/[\\/][^\\/]*$/, ''),
    onDependency: path => dependencies.push(path),
  });
  const scanner = new Scanner({
    sources: [{ base: options.sourceDir, pattern: options.pattern ?? '**/*.{vue,ts}', negated: false }],
  });
  const css = compiler.build([...scanner.scan(), ...(options.extraCandidates ?? [])]);
  return { css: optimize(css, { minify: true }).code, dependencies };
}
