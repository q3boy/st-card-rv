import { expect, test } from 'bun:test';
import { compileTailwind, unwrapPropertiesSupports } from '../../scripts/tailwind';

test('展开 @layer properties 外层的 @supports，保留其中变量默认值', () => {
  const css =
    '@layer properties{@supports (a:b) and (not (c:d)){*,:before{--tw-translate-y:0;--tw-border-style:solid}}}.x{color:red}';
  expect(unwrapPropertiesSupports(css)).toBe(
    '@layer properties{*,:before{--tw-translate-y:0;--tw-border-style:solid}}.x{color:red}',
  );
});
test('没有可展开的 @supports 或结构异常时构建失败', () => {
  expect(() => unwrapPropertiesSupports('.x{color:red}')).toThrow('没有 `@layer properties`');
  expect(() => unwrapPropertiesSupports('@layer properties{*{--tw-a:0}}')).toThrow('没有 `@layer properties`');
  expect(() => unwrapPropertiesSupports('@layer properties{@supports (a:b){*{--tw-a:0}')).toThrow('没有按预期闭合');
  expect(() => unwrapPropertiesSupports('@layer properties{@supports (a:b){*{color:red}}}')).toThrow('--tw-');
});
test('真实 Tailwind 输出被展开，对照输出仍带 @supports', async () => {
  const processed = (await compileTailwind(['border', '-translate-y-1/2'])).css;
  const raw = (await compileTailwind(['border', '-translate-y-1/2'], false)).css;
  expect(raw).toMatch(/@layer properties\{@supports/);
  expect(processed).not.toMatch(/@layer properties\{@supports/);
  expect(processed).toMatch(/@layer properties\{\*,:before,:after,::backdrop\{[^}]*--tw-border-style:solid/);
});
