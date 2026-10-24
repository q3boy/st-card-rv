export {};
const env = { ...process.env, CARD_RV_BUILD_DIR: '.test-data/card-rv/build' };
for (const args of [
  ['bun', 'run', 'scripts/build.ts'],
  ['bun', 'run', 'scripts/tailwind-probe.ts'],
  ['bun', 'x', '--no-install', 'playwright', 'test', '--config', 'playwright.config.ts', ...process.argv.slice(2)],
]) {
  const child = Bun.spawn(args, { env, stdout: 'inherit', stderr: 'inherit' });
  const status = await child.exited;
  if (status) process.exit(status);
}
