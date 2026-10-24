import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { compileScript, compileStyle, compileTemplate, parse } from '@vue/compiler-sfc';
import type { PluginBuilder } from 'bun';

/** 作用域样式 ID；由调用方提供前缀。 */
export const vueScopeId = (path: string, prefix: string) => `data-v-${prefix}-${Bun.hash(path).toString(16)}`;

const parseVue = async (path: string) => {
  const { descriptor, errors } = parse(await Bun.file(path).text(), { filename: path });
  if (errors.length) throw errors[0];
  return descriptor;
};

/** 让 `defineProps<ImportedInterface>()` 能跨文件解析类型并推出运行时 props。 */
const sfcFs = {
  fileExists: (file: string) => existsSync(file),
  readFile: (file: string) => readFileSync(file, 'utf8'),
  realpath: (file: string) => realpathSync(file),
};

/** 递归列出目录下全部 `.vue` 文件，按路径排序以保证产物稳定。 */
export async function listVueFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true });
  return entries
    .filter(name => name.endsWith('.vue'))
    .sort()
    .map(name => join(dir, name));
}

/** 编译一组 `.vue` 文件里的 `<style>`（含 scoped），合并为一段 CSS。 */
export async function compileVueStyles(paths: string[], prefix: string): Promise<string> {
  const parts = await Promise.all(
    paths.map(async path => {
      const descriptor = await parseVue(path);
      const id = vueScopeId(path, prefix);
      return descriptor.styles
        .map(style => {
          const compiled = compileStyle({ source: style.content, filename: path, id, scoped: style.scoped });
          if (compiled.errors.length) throw compiled.errors[0];
          return compiled.code;
        })
        .join('\n');
    }),
  );
  return parts.join('\n');
}

/**
 * 注册 `.vue` 加载器：构建期预编译 `<script setup lang="ts">` 与模板，样式另用 {@link compileVueStyles}。
 * `vue` 如何解析由调用方决定，房车卡替换为 `globalThis.Vue`。
 */
export function registerVueLoader(builder: PluginBuilder, prefix: string): void {
  builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
    const descriptor = await parseVue(path);
    const id = vueScopeId(path, prefix);
    const script = compileScript(descriptor, { id, genDefaultAs: '__component', fs: sfcFs });
    const template = compileTemplate({
      source: descriptor.template?.content ?? '',
      filename: path,
      id,
      compilerOptions: {
        bindingMetadata: script.bindings,
        // 模板表达式里可以写 TypeScript（如 `as` 断言）。
        ...(descriptor.scriptSetup?.lang === 'ts' || descriptor.script?.lang === 'ts'
          ? { expressionPlugins: ['typescript' as const] }
          : {}),
      },
    });
    if (template.errors.length) throw template.errors[0];
    return {
      loader: 'ts',
      resolveDir: dirname(path),
      contents: `${script.content}\n${template.code}
          __component.render = render;
          ${descriptor.styles.some(style => style.scoped) ? `__component.__scopeId = ${JSON.stringify(id)};` : ''}
          export default __component;`,
    };
  });
}
