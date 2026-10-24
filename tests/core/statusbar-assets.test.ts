import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { Script } from 'node:vm';
import sharp from 'sharp';
import * as Vue from 'vue';

const root = resolve(import.meta.dir, '../..');
const output = join(root, '.test-data/card-rv', `asset-build-${crypto.randomUUID()}`);
const assetRoot = '状态栏素材/图形/';
const artRoot = '状态栏素材/房车配图/';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
interface ImageRecord {
  source: string;
  sourceSha256: string;
  sourceBytes: number;
  output: string;
  outputSha256: string;
  theme?: string;
  kind: string;
  format: 'webp' | 'svg';
  bytes: number;
  width: number;
  height: number;
  alpha?: boolean;
  viewBox?: string;
}
interface BuildRecord {
  buildId: string;
  bytes: number;
  scriptSha256: string;
  sourceHashes: Record<string, string>;
  images: ImageRecord[];
  licenses: { source: string; output: string };
}
let build: BuildRecord, script: string;

beforeAll(async () => {
  const child = Bun.spawn([process.execPath, 'run', 'scripts/build.ts'], {
    cwd: root,
    env: { ...process.env, CARD_RV_BUILD_DIR: relative(root, output) },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [status, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (status !== 0) throw new Error(`房车素材构建失败\n${stdout}\n${stderr}`);
  build = (await Bun.file(join(output, 'build.json')).json()) as BuildRecord;
  script = await Bun.file(join(output, '状态栏.js')).text();
}, 120_000);
afterAll(async () => {
  // 只删除本测试创建的唯一目录，不清理其他构建或已存验证证据。
  if (dirname(output) !== join(root, '.test-data/card-rv') || !output.split(/[\\/]/).at(-1)?.startsWith('asset-build-'))
    throw new Error(`拒绝清理测试范围外的目录：${output}`);
  sharp.cache(false);
  await rm(output, { recursive: true, force: true });
});

describe('房车状态栏构建资源', () => {
  const isArt = (image: ImageRecord) => image.source.startsWith(artRoot);
  const kinds = ['drive', 'park', 'expand'],
    periods = ['dawn', 'day', 'dusk', 'night'];

  test('输出为 12 张配图加显式导入的 SVG，每张记录与文件、数据 URL 一致', async () => {
    expect(new Set(build.images.map(image => image.output)).size).toBe(build.images.length);
    for (const image of build.images) {
      expect(image.source.startsWith(assetRoot) || isArt(image)).toBe(true);
      expect(image.source).not.toMatch(/预览|确认稿|山景|.html$|底图/);
      const source = new Uint8Array(await Bun.file(join(root, image.source)).arrayBuffer());
      const bytes = new Uint8Array(await Bun.file(join(output, image.output)).arrayBuffer());
      expect(image.sourceSha256).toBe(sha256(source));
      expect(image.sourceBytes).toBe(source.byteLength);
      expect(image.outputSha256).toBe(sha256(bytes));
      expect(image.bytes).toBe(bytes.byteLength);
      const mime = image.format === 'webp' ? 'webp' : 'svg+xml';
      expect(script.includes(`data:image/${mime};base64,${Buffer.from(bytes).toString('base64')}`)).toBe(true);
    }
    const outputFiles = (await readdir(join(output, 'images'), { recursive: true })).filter(path =>
      /.(webp|svg)$/.test(path),
    );
    expect(outputFiles.length).toBe(build.images.length);
    expect(
      build.images
        .filter(image => !isArt(image))
        .map(image => image.output)
        .sort(),
    ).toEqual(['images/图形/map-person.svg', 'images/图形/map-rv.svg', 'images/图形/title-contours.svg']);
    const art = build.images.filter(isArt);
    expect(art.map(image => image.output).sort()).toEqual(
      kinds.flatMap(kind => periods.map(period => `images/房车配图/rv-${kind}-${period}.webp`)).sort(),
    );
  });

  test('12 张配图缩放到 888 宽并保留完整画幅与透明天空，原始 PNG 不变，SVG 保留原字节及 viewBox', async () => {
    for (const image of build.images) {
      const source = join(root, image.source),
        file = join(output, image.output);
      if (image.format === 'webp') {
        expect(isArt(image)).toBe(true);
        expect(image.kind).toBe('illustration');
        expect([image.width, image.height, image.alpha]).toEqual([888, 555, true]);
        const original = await sharp(source).metadata();
        const compressed = await sharp(file).metadata();
        expect([original.width, original.height, original.format, original.hasAlpha]).toEqual([1586, 992, 'png', true]);
        expect(compressed.format).toBe('webp');
        expect(image.bytes).toBeLessThan(image.sourceBytes / 5);
        const alpha = await sharp(file).extractChannel('alpha').stats();
        expect(alpha.channels[0]!.min).toBe(0);
        expect(alpha.channels[0]!.max).toBe(255);
      } else {
        const [original, svg] = await Promise.all([Bun.file(source).text(), Bun.file(file).text()]);
        expect(svg).toBe(original);
        expect(image.viewBox).toBe(/\sviewBox="([^"]+)"/.exec(original)?.[1]);
        expect(image).not.toHaveProperty('alpha');
        const metadata = await sharp(file).metadata();
        expect([metadata.width, metadata.height]).toEqual([image.width, image.height]);
      }
    }
  });

  test('IIFE可独立启动并携带数据URL、许可和源码哈希', async () => {
    expect(Buffer.byteLength(script)).toBe(build.bytes);
    expect(sha256(Buffer.from(script))).toBe(build.scriptSha256);
    expect(script).not.toMatch(/file:\/\/|[A-Z]:[\\/]codes[\\/]|\.\.\/状态栏素材/);
    const licenseManifest = (await Bun.file(join(root, build.licenses.source)).json()) as {
      sources: { licenseText: string }[];
    };
    const notices = await Bun.file(join(output, build.licenses.output)).text();
    for (const source of licenseManifest.sources) {
      expect(notices.includes(source.licenseText)).toBe(true);
      expect(script.includes(source.licenseText)).toBe(true);
    }
    for (const source of [
      '状态栏/assets.d.ts',
      'scripts/build.ts',
      'scripts/tailwind.ts',
      'package.json',
      'bun.lock',
      build.licenses.source,
    ])
      expect(build.sourceHashes[source]).toBe(sha256(new Uint8Array(await Bun.file(join(root, source)).arrayBuffer())));
    const initialized: string[] = [];
    const window = {
      parent: { addEventListener() {}, removeEventListener() {} },
      getScriptId: () => 'asset-build-test',
      addEventListener() {},
      removeEventListener() {},
      waitGlobalInitialized(name: string) {
        initialized.push(name);
        return new Promise(() => {});
      },
    };
    new Script(script).runInNewContext({ Vue, window, console });
    expect(initialized).toEqual(['DVS', 'SqliteHelper']);
  });
});
