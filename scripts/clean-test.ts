import { execFileSync } from 'node:child_process';
import type { Stats } from 'node:fs';
import { chmod, lstat, readdir, realpath, rmdir, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

// Only reproducible default test outputs belong here. Custom output paths are never inferred from environment variables.
export const testArtifactGroups = {
  'card-rv': ['card-rv', 'evidence/房车地图提示与标识'],
} as const;
export type TestArtifactGroup = keyof typeof testArtifactGroups;
export interface CleanResult {
  files: number;
  bytes: number;
  errors: { path: string; message: string }[];
}

function samePath(left: string, right: string): boolean {
  // Bun's Windows realpath returns a drive root without its trailing separator.
  if (/^[a-z]:$/i.test(left)) left += sep;
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

async function checkPath(path: string): Promise<Stats> {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !samePath(await realpath(path), path)) {
    throw new Error('拒绝清理符号链接或目录联接。');
  }
  return info;
}

async function checkAncestors(path: string): Promise<void> {
  const parent = dirname(path);
  if (parent !== path) await checkAncestors(parent);
  const info = await checkPath(path);
  if (!info.isDirectory()) throw new Error('清理路径的祖先必须为普通目录。');
}

// Node identifies junctions as symbolic links. Also reject other Windows reparse points before any deletion.
function checkWindowsReparsePoints(path: string): void {
  if (process.platform !== 'win32') return;
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `
    $ErrorActionPreference = 'Stop'
    $target = $env:SQLITE_HELPER_CLEAN_CHECK_PATH
    $current = [System.IO.DirectoryInfo]::new($target)
    while ($null -ne $current) {
      if (($current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "ReparsePoint: $($current.FullName)" }
      $current = $current.Parent
    }
    $pending = [System.Collections.Generic.Stack[string]]::new()
    $pending.Push($target)
    while ($pending.Count -gt 0) {
      $entry = $pending.Pop()
      $attributes = [System.IO.File]::GetAttributes($entry)
      if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "ReparsePoint: $entry" }
      if (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) {
        foreach ($child in [System.IO.Directory]::EnumerateFileSystemEntries($entry)) { $pending.Push($child) }
      }
    }
  `,
    ],
    { env: { ...process.env, SQLITE_HELPER_CLEAN_CHECK_PATH: path }, stdio: 'pipe' },
  );
}

/** The CLI fixes root to this script's workspace; tests supply an isolated workspace, never extra deletion paths. */
export async function cleanTestArtifacts(root: string, groups: readonly TestArtifactGroup[]): Promise<CleanResult> {
  const result: CleanResult = { files: 0, bytes: 0, errors: [] };
  const recordError = (path: string, error: unknown) => {
    result.errors.push({ path, message: error instanceof Error ? error.message : String(error) });
  };
  root = resolve(root);
  try {
    await checkAncestors(root);
    if (groups.some(group => !Object.hasOwn(testArtifactGroups, group))) throw new Error('未知清理分组。');
  } catch (error) {
    recordError(root, error);
    return result;
  }
  const paths = new Set(groups.flatMap(group => testArtifactGroups[group].map(path => `.test-data/${path}`)));
  for (const output of paths) {
    const target = resolve(root, output);
    const inside = relative(root, target);
    if (!inside || isAbsolute(inside) || inside.split(sep).includes('..')) {
      recordError(output, new Error('清理目标必须位于工作区内。'));
      continue;
    }
    const files: { path: string; bytes: number; readOnly: boolean }[] = [];
    const directories: string[] = [];
    async function inspect(path: string): Promise<void> {
      const info = await checkPath(path);
      if (info.isDirectory()) {
        for (const entry of await readdir(path)) await inspect(resolve(path, entry));
        directories.push(path);
      } else if (info.isFile())
        files.push({ path, bytes: info.size, readOnly: process.platform === 'win32' && (info.mode & 0o200) === 0 });
      else throw new Error('清理目标包含非普通文件。');
    }
    try {
      // Check existing ancestors even when the target itself is absent.
      const parts = inside.split(sep);
      let parent = root;
      let missing = false;
      for (const part of parts.slice(0, -1)) {
        parent = resolve(parent, part);
        try {
          await checkPath(parent);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          missing = true;
          break;
        }
      }
      if (missing) continue;
      try {
        await lstat(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      checkWindowsReparsePoints(target);
      await inspect(target);
    } catch (error) {
      recordError(output, error);
      continue;
    }
    for (const file of files) {
      try {
        if (file.readOnly) await chmod(file.path, 0o666);
        await unlink(file.path);
        result.files++;
        result.bytes += file.bytes;
      } catch (error) {
        recordError(relative(root, file.path), error);
      }
    }
    for (const directory of directories) {
      try {
        await rmdir(directory);
      } catch (error) {
        recordError(relative(root, directory), error);
      }
    }
  }
  return result;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || (args[0] !== 'all' && !Object.hasOwn(testArtifactGroups, args[0]!))) {
    console.error('用法：bun run scripts/clean-test.ts card-rv|all（不接受目录参数）');
    process.exitCode = 1;
  } else {
    const groups =
      args[0] === 'all' ? (Object.keys(testArtifactGroups) as TestArtifactGroup[]) : [args[0] as TestArtifactGroup];
    const result = await cleanTestArtifacts(resolve(import.meta.dir, '..'), groups);
    for (const error of result.errors) console.error(`${error.path}: ${error.message}`);
    console.log(`清理完成：删除 ${result.files} 个文件，${result.bytes} 字节，${result.errors.length} 个错误。`);
    if (result.errors.length) process.exitCode = 1;
  }
}
