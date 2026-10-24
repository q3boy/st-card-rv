// 把 12 张融合 PNG 编码成同名 WebP：node encode-webp.mjs <PNG 目录> <输出目录>
// 参数见 ../WebP交付方案.md；使用仓库已有的 sharp。
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [src, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src).filter(n => /^rv-.+\.png$/.test(n))) {
  const to = path.join(out, f.replace(/\.png$/, '.webp'));
  await sharp(path.join(src, f)).webp({ lossless: false, quality: 90, alphaQuality: 100, effort: 6 }).toFile(to);
  console.log(to, fs.statSync(to).size);
}
