import { join, resolve } from 'node:path';
import { compileVueStyles, listVueFiles, registerVueLoader } from './vue-sfc';

const root = resolve(import.meta.dir, '..');

/** 编译唯一作者注册入口，包含 NPC 组件；不写回卡片源文件。 */
export async function buildNpcAuthor(): Promise<string> {
  const directory = join(root, '生成拦截/npc');
  const styles = await Bun.file(join(directory, 'styles.css')).text();
  const componentStyles = await compileVueStyles(await listVueFiles(directory), 'rv-npc');
  const yamlLicense = await Bun.file(join(root, 'node_modules/yaml/LICENSE')).text();
  const iconSources = (await Bun.file(join(root, '状态栏素材/vector-assets.json')).json()) as {
    sources: Array<{ package: string; licenseText: string }>;
  };
  const iconLicense = iconSources.sources.find(source => source.package === '@phosphor-icons/vue')!.licenseText;
  const vueExports = Object.keys(await import('vue')).filter(name => /^[A-Za-z_$][\w$]*$/.test(name));
  const result = await Bun.build({
    entrypoints: [join(root, '脚本/DVS.js')],
    target: 'browser',
    format: 'iife',
    minify: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
    plugins: [
      {
        name: 'rv-npc-author',
        setup(builder) {
          builder.onResolve({ filter: /^virtual:rv-npc-styles$/ }, () => ({
            path: 'styles',
            namespace: 'rv-npc-styles',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'rv-npc-styles' }, () => ({
            loader: 'js',
            contents: `export default ${JSON.stringify(styles + '\n' + componentStyles)};`,
          }));
          builder.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'rv-npc-vue' }));
          builder.onLoad({ filter: /.*/, namespace: 'rv-npc-vue' }, () => ({
            loader: 'js',
            contents: `const runtime = globalThis.Vue;
if (!runtime || !/^3\\.5\\./.test(runtime.version)) throw new Error('NPC 界面需要酒馆助手的 Vue 3.5，请更新酒馆助手后重开角色。');
${vueExports.map(name => `export const ${name} = runtime.${name};`).join('\n')}`,
          }));
          registerVueLoader(builder, 'rv-npc');
        },
      },
    ],
  });
  if (!result.success) throw new AggregateError(result.logs, '房车 NPC 作者脚本构建失败');
  return `/*! yaml — ISC\n${yamlLicense.replaceAll('*/', '* /')}\n*/\n/*! @phosphor-icons/vue — MIT\n${iconLicense.replaceAll('*/', '* /')}\n*/\n${await result.outputs[0]!.text()}`;
}
