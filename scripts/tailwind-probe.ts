import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compileTailwind } from './tailwind';

// 浏览器测试用：生产的编译流程加上探针类名，另输出未展开的对照，证明测试前提成立。
const output = resolve(import.meta.dir, '..', process.env.CARD_RV_BUILD_DIR ?? '.test-data/card-rv/build');
const probe = ['border', '-translate-y-1/2'];
await mkdir(output, { recursive: true });
await writeFile(join(output, 'tailwind-probe.css'), (await compileTailwind(probe)).css);
await writeFile(join(output, 'tailwind-probe-raw.css'), (await compileTailwind(probe, false)).css);
