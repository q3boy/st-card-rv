import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  formatLinkIssues,
  type LinkIssue,
  localMarkdownTarget,
  markdownAnchors,
  markdownLinks,
} from './markdown-links';

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Include tracked and new documents, excluding ignored/generated files and deleted files. */
export async function documentPaths(root: string): Promise<string[]> {
  const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
  if (resolve(gitRoot).toLowerCase() !== resolve(root).toLowerCase()) {
    throw new Error('请在房车自己的 Git 仓库运行文档检查，不能向上读取父库文件列表。');
  }
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\0');
  const selected = [...new Set(paths)].filter(path =>
    /^(?:[^/]+\.md|(?:doc|tools)\/.+\.md|tests\/AGENTS\.md)$/.test(path),
  );
  const present = await Promise.all(
    selected.sort().map(async path => ((await exists(resolve(root, path))) ? path : undefined)),
  );
  return present.filter(path => path !== undefined);
}

/** Check the working tree on disk. No index, network requests, or writes are needed. */
export async function checkDocuments(root: string, paths: string[]) {
  const errors: LinkIssue[] = [];
  const headings = new Map<string, Set<string>>();
  let links = 0;
  for (const source of paths) {
    const text = await readFile(resolve(root, source), 'utf8');
    for (const { href, line } of markdownLinks(text)) {
      let reason: string | undefined;
      let target: ReturnType<typeof localMarkdownTarget>;
      try {
        target = localMarkdownTarget(root, source, href);
        if (!target) continue;
      } catch (error) {
        reason = error instanceof URIError ? '链接包含无效的 URL 编码' : (error as Error).message;
      }
      links++;
      if (target) {
        const absolute = resolve(root, target.path);
        if (!(await exists(absolute))) reason = '目标文件或目录不存在';
        else if (target.anchor && /\.md$/i.test(target.path)) {
          let available = headings.get(absolute);
          if (!available) {
            available = markdownAnchors(await readFile(absolute, 'utf8'));
            headings.set(absolute, available);
          }
          if (!available.has(target.anchor)) reason = `章节锚点不存在：#${target.anchor}`;
        }
      }
      if (reason) errors.push({ source, line, href, reason });
    }
  }
  return { files: paths.length, links, errors };
}

if (import.meta.main) {
  try {
    const root = resolve(import.meta.dir, '..');
    const result = await checkDocuments(root, await documentPaths(root));
    if (result.errors.length) console.error(formatLinkIssues(result.errors));
    console.log(`文档链接检查：${result.files} 个文件，${result.links} 个本地链接，${result.errors.length} 个错误。`);
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) {
    console.error(`文档链接检查失败：${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
