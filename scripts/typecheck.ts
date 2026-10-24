// Vue 模板与 TypeScript 源码统一使用本库安装的 TypeScript。
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { run } = require('vue-tsc') as { run(tscPath: string): void };
process.argv = [process.argv[0]!, process.argv[1]!, '-p', 'tsconfig.json'];
run(require.resolve('typescript/lib/tsc.js'));
