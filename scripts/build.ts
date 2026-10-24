import { mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { version } from '@vue/compiler-sfc';
import sharp from 'sharp';
import { version as tailwindVersion } from 'tailwindcss/package.json' with { type: 'json' };
import { compileTailwind, tailwindEntry } from './tailwind';
import { compileVueStyles, registerVueLoader } from './vue-sfc';

const root = resolve(import.meta.dir, '..');
const output = resolve(root, process.env.CARD_RV_BUILD_DIR ?? '.test-data/card-rv/build');
const buildId = crypto.randomUUID();
const sourceDir = join(root, '状态栏');
const assetRoot = join(root, '状态栏素材/图形');
const artRoot = join(root, '状态栏素材/房车配图');
// 配图显示宽度约 444 CSS px（宽屏 900px 面板的左列），按 2 倍屏编码为 888 像素宽；编码参数见 WebP 交付方案。
const artWidth = 888;
const licenseSource = '状态栏素材/vector-assets.json';
const licenseManifest = (await Bun.file(join(root, licenseSource)).json()) as {
  sources: Array<{ package: string; version: string; license: string; licenseText: string }>;
};
const licenseText = licenseManifest.sources
  .map(source => `${source.package} ${source.version}\n${source.licenseText}`)
  .join('\n');
const tailwind = await compileTailwind();
const sourceFiles = (await readdir(sourceDir)).filter(name => /\.(ts|vue)$/.test(name)).sort();
await mkdir(output, { recursive: true });
type ImageRecord = {
  source: string;
  sourceSha256: string;
  sourceBytes: number;
  output: string;
  outputSha256: string;
  kind: 'illustration' | 'icon';
  format: 'webp' | 'svg';
  width: number;
  height: number;
  bytes: number;
  alpha?: boolean;
  viewBox?: string;
};
const images: ImageRecord[] = [];

const result = await Bun.build({
  entrypoints: [join(root, '状态栏/entry.ts')],
  target: 'browser',
  format: 'iife',
  minify: true,
  define: {
    __RV_BUILD_ID__: JSON.stringify(buildId),
    'process.env.NODE_ENV': JSON.stringify('production'),
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  plugins: [
    {
      name: 'rv-precompiled-vue-and-images',
      setup(builder) {
        builder.onResolve({ filter: /^virtual:rv-styles$/ }, () => ({ path: 'styles', namespace: 'rv-styles' }));
        builder.onLoad({ filter: /.*/, namespace: 'rv-styles' }, async () => {
          // Tailwind 在前；组件里不带层级的手写规则仍压过工具类，迁移时须删除或放入 @layer。
          const componentStyles = await compileVueStyles(
            sourceFiles.filter(name => name.endsWith('.vue')).map(name => join(sourceDir, name)),
            'rv',
          );
          return { loader: 'js', contents: `export default ${JSON.stringify(`${tailwind.css}\n${componentStyles}`)};` };
        });
        builder.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'rv-vue-global' }));
        builder.onLoad({ filter: /.*/, namespace: 'rv-vue-global' }, async () => {
          // 静态命名导出交给编译器裁剪；不通过 eval 在浏览器编译 Vue。
          const exports = Object.keys(await import('vue')).filter(name => /^[A-Za-z_$][\w$]*$/.test(name));
          return {
            loader: 'js',
            contents: `const runtime = globalThis.Vue;
          if (!runtime || !/^3\\.5\\./.test(runtime.version)) throw new Error('房车状态栏需要酒馆助手提供 Vue 3.5 runtime');
          ${exports.map(name => `export const ${name} = runtime.${name};`).join('\n')}`,
          };
        });
        registerVueLoader(builder, 'rv');
        builder.onLoad({ filter: /\.(png|svg)$/ }, async ({ path }) => {
          const source = relative(root, path).replaceAll('\\', '/');
          const artMatch = /^(rv-(?:drive|park|expand)-(?:dawn|day|dusk|night))\.png$/.exec(
            relative(artRoot, path).replaceAll('\\', '/'),
          );
          if (artMatch) {
            const sourceBytes = new Uint8Array(await Bun.file(path).arrayBuffer());
            // 保留完整透明天空与画幅，只缩小；颜色有损，Alpha 质量 100。
            const data = await sharp(sourceBytes)
              .resize({ width: artWidth, kernel: 'lanczos3', withoutEnlargement: true })
              .webp({ lossless: false, quality: 90, alphaQuality: 100, effort: 6 })
              .toBuffer();
            const metadata = await sharp(data).metadata();
            const outputPath = `images/房车配图/${artMatch[1]}.webp`;
            await mkdir(dirname(join(output, outputPath)), { recursive: true });
            await writeFile(join(output, outputPath), data);
            images.push({
              source,
              kind: 'illustration',
              format: 'webp',
              output: outputPath,
              sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
              sourceBytes: sourceBytes.byteLength,
              outputSha256: createHash('sha256').update(data).digest('hex'),
              bytes: data.byteLength,
              width: metadata.width!,
              height: metadata.height!,
              alpha: !!metadata.hasAlpha,
            });
            return {
              loader: 'js',
              contents: `export default ${JSON.stringify('data:image/webp;base64,' + data.toString('base64'))};`,
            };
          }
          const svgMatch = /^([^/]+\.svg)$/.exec(relative(assetRoot, path).replaceAll('\\', '/'));
          if (!svgMatch) throw new Error(`状态栏仅接受图形目录中的 SVG 与房车配图目录中的 PNG：${source}`);
          const data = Buffer.from(await Bun.file(path).arrayBuffer());
          const attributes = /<svg\b([^>]*)>/.exec(data.toString('utf8'))?.[1] ?? '';
          const attribute = (name: string) => new RegExp(`\\b${name}=["']([^"']+)["']`).exec(attributes)?.[1];
          const viewBox = attribute('viewBox');
          const width = Number(attribute('width')),
            height = Number(attribute('height'));
          if (!viewBox || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
            throw new Error(`SVG缺少有效尺寸或viewBox：${source}`);
          const outputPath = `images/图形/${svgMatch[1]}`;
          await mkdir(dirname(join(output, outputPath)), { recursive: true });
          await writeFile(join(output, outputPath), data);
          const sha256 = createHash('sha256').update(data).digest('hex');
          images.push({
            source,
            kind: 'icon',
            format: 'svg',
            output: outputPath,
            sourceSha256: sha256,
            sourceBytes: data.byteLength,
            outputSha256: sha256,
            bytes: data.byteLength,
            width,
            height,
            viewBox,
          });
          return {
            loader: 'js',
            contents: `export default ${JSON.stringify('data:image/svg+xml;base64,' + data.toString('base64'))};`,
          };
        });
      },
    },
  ],
});
if (!result.success) throw new AggregateError(result.logs, '房车状态栏构建失败');
const scriptPath = join(output, '状态栏.js');
const content = await result.outputs[0]!.text();
const scriptContent = `// 房车状态栏 build ${buildId}; Vue compiler ${version}\n/*!\n${licenseText.replaceAll('*/', '* /')}\n*/\n${content}\n`;
await writeFile(scriptPath, scriptContent);
await writeFile(join(output, 'THIRD-PARTY-LICENSES.txt'), licenseText);
const sources = sourceFiles.map(name => `状态栏/${name}`);
sources.push(
  tailwindEntry,
  'scripts/tailwind.ts',
  '脚本/DVS.js',
  'index.yaml',
  'scripts/build.ts',
  licenseSource,
  'package.json',
  'bun.lock',
);
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async source => [
      source,
      createHash('sha256')
        .update(new Uint8Array(await Bun.file(join(root, source)).arrayBuffer()))
        .digest('hex'),
    ]),
  ),
);
await writeFile(
  join(output, 'build.json'),
  JSON.stringify(
    {
      buildId,
      vueCompiler: version,
      tailwind: { version: tailwindVersion, cssBytes: Buffer.byteLength(tailwind.css) },
      bytes: Buffer.byteLength(scriptContent),
      sourceHashes,
      scriptSha256: createHash('sha256')
        .update(new Uint8Array(await Bun.file(scriptPath).arrayBuffer()))
        .digest('hex'),
      licenses: { source: licenseSource, output: 'THIRD-PARTY-LICENSES.txt' },
      images: images.sort((a, b) => a.source.localeCompare(b.source)),
    },
    null,
    2,
  ),
);
if (process.argv.includes('--publish')) {
  await copyFile(scriptPath, join(root, '脚本/状态栏.js'));
}
console.log(
  `房车状态栏 ${buildId}: ${Buffer.byteLength(scriptContent)} bytes; ${images.filter(image => image.format === 'webp').length} WebP + ${images.filter(image => image.format === 'svg').length} SVG; ${scriptPath}`,
);
