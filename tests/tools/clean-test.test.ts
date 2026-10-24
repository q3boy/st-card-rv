import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { cleanTestArtifacts } from '../../scripts/clean-test';

test('clean removes only child test outputs and the fixed map evidence directory', async () => {
  const base = resolve(import.meta.dir, '../../.test-data/card-rv/tools');
  await mkdir(base, { recursive: true });
  const parent = await mkdtemp(join(base, 'clean-'));
  const child = join(parent, 'card/房车');
  const removed = ['.test-data/card-rv/build/script.js', '.test-data/evidence/房车地图提示与标识/map.png'];
  const preserved = ['.test-data/evidence/other/keep.txt', 'dist/card.png', 'index.yaml'];
  try {
    for (const file of [...removed, ...preserved]) {
      await mkdir(dirname(join(child, file)), { recursive: true });
      await writeFile(join(child, file), 'data');
    }
    for (const file of [
      '.test-data/card-rv/old.txt',
      '.test-data/evidence/keep.txt',
      '.test-data/lorebook-version/a.png',
    ]) {
      await mkdir(dirname(join(parent, file)), { recursive: true });
      await writeFile(join(parent, file), 'parent');
    }
    const result = await cleanTestArtifacts(child, ['card-rv']);
    expect(result.errors).toEqual([]);
    expect(result.files).toBe(2);
    for (const file of removed) expect(await Bun.file(join(child, file)).exists()).toBe(false);
    for (const file of preserved) expect(await Bun.file(join(child, file)).text()).toBe('data');
    for (const file of [
      '.test-data/card-rv/old.txt',
      '.test-data/evidence/keep.txt',
      '.test-data/lorebook-version/a.png',
    ]) {
      expect(await Bun.file(join(parent, file)).text()).toBe('parent');
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
