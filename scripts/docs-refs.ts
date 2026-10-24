import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { documentPaths } from './docs-check';
import { localMarkdownTarget, markdownReferences, markdownSections } from './markdown-links';

export interface DocumentReference {
  source: string;
  line: number;
  section: string;
  sourceAnchor?: string;
  href: string;
  target: string;
  targetPath?: string;
  targetAnchor?: string;
}

const samePath = (left: string, right: string) =>
  process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;

/** Scan explicit links in the current working tree; existence is not required for incoming targets. */
export async function queryDocumentReferences(root: string, query: string, paths: string[]) {
  const target = localMarkdownTarget(root, '__query__.md', query.replace(/\\/g, '/'));
  if (!target || !/\.md$/i.test(target.path)) throw new Error('请指定相对仓库根目录的 Markdown 路径，可追加 #锚点');
  let targetText: string | undefined;
  try {
    targetText = await readFile(resolve(root, target.path), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const sections = targetText === undefined ? [] : markdownSections(targetText);
  const section = target.anchor ? sections.find(item => item.anchor === target.anchor) : undefined;
  const unavailable = targetText === undefined ? '文件不存在' : target.anchor && !section ? '锚点不存在' : undefined;
  const incoming: DocumentReference[] = [];
  const documentIncoming: DocumentReference[] = [];
  const outgoing: DocumentReference[] = [];
  const warnings: string[] = [];
  const sources = [...paths];
  if (targetText !== undefined && !sources.some(path => samePath(path, target.path))) sources.push(target.path);
  for (const source of [...new Set(sources)].sort()) {
    const isTarget = samePath(source, target.path);
    const text = isTarget && targetText !== undefined ? targetText : await readFile(resolve(root, source), 'utf8');
    const sourceSections = markdownSections(text);
    for (const { href, line } of markdownReferences(text)) {
      let resolved: ReturnType<typeof localMarkdownTarget>;
      try {
        resolved = localMarkdownTarget(root, source, href);
      } catch (error) {
        warnings.push(`${source}:${line}: 无法解析链接 ${href}（${(error as Error).message}）`);
      }
      const owner = sourceSections.filter(item => item.line <= line).at(-1);
      const reference: DocumentReference = {
        source,
        line,
        section: owner?.title ?? '(文档开头)',
        sourceAnchor: owner?.anchor,
        href,
        target: resolved ? resolved.path + (resolved.anchor ? `#${resolved.anchor}` : '') : href,
        targetPath: resolved?.path,
        targetAnchor: resolved?.anchor,
      };
      if (resolved && samePath(resolved.path, target.path)) {
        if (!target.anchor || target.anchor === resolved.anchor) incoming.push(reference);
        else if (!resolved.anchor) documentIncoming.push(reference);
      }
      if (isTarget && !unavailable && (!section || (line >= section.line && line <= section.endLine)))
        outgoing.push(reference);
    }
  }
  return {
    target: target.path + (target.anchor ? `#${target.anchor}` : ''),
    incoming,
    documentIncoming,
    outgoing,
    unavailable,
    warnings,
    scanned: sources.length,
  };
}

export function formatDocumentReferences(
  result: Awaited<ReturnType<typeof queryDocumentReferences>>,
  direction: 'in' | 'out',
) {
  const lines = [`查询：${result.target}`, ''];
  const queryPath = result.target.split('#')[0];
  const chapterQuery = result.target.includes('#');
  const cell = (value: string | number) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .replace(/`/g, '\\`')
      .replace(/\r?\n/g, '<br>');
  const table = (headers: string[], rows: (string | number)[][]) => {
    if (!rows.length) return;
    lines.push(`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`);
    for (const row of rows) lines.push(`| ${row.map(cell).join(' | ')} |`);
    lines.push('');
  };
  if (direction === 'in') {
    if (result.unavailable) lines.push(`${result.unavailable}；以下查询当前工作区中的残留引用。`, '');
    lines.push(`来源引用：${result.incoming.length} 处`, '');
    const sources = (references: DocumentReference[]) =>
      table(
        ['来源文件', '章节'],
        references.map(item => [`${item.source}:${item.line}`, item.section]),
      );
    if (chapterQuery) sources(result.incoming);
    else {
      const groups = new Map<string, DocumentReference[]>();
      for (const item of result.incoming) {
        const anchor = item.targetAnchor || '';
        if (!groups.has(anchor)) groups.set(anchor, []);
        groups.get(anchor)!.push(item);
      }
      for (const [anchor, references] of groups) {
        lines.push(`指向：${anchor ? cell(`#${anchor}`) : '整篇文档'}（${references.length} 处）`, '');
        sources(references);
      }
    }
    if (chapterQuery && result.documentIncoming.length) {
      lines.push(`仅指向整篇文档的来源：${result.documentIncoming.length} 处（不计入该章节）`, '');
      sources(result.documentIncoming);
    }
  } else if (result.unavailable) {
    lines.push(`${result.unavailable}，无法取得原文或原章节的对外引用。`);
  } else {
    lines.push(`对外引用：${result.outgoing.length} 处`, '');
    table(
      ['当前文档行号', '章节', '目标'],
      result.outgoing.map(item => [
        item.line,
        item.section,
        item.targetPath && samePath(item.targetPath, queryPath) ? `#${item.targetAnchor || ''}` : item.target,
      ]),
    );
  }
  return lines.join('\n').trimEnd();
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    const [direction, query] = args;
    if (args.length !== 2 || (direction !== 'in' && direction !== 'out') || query.startsWith('-'))
      throw new Error('用法：bun run docs:refs:in 或 docs:refs:out "文档路径.md[#章节锚点]"');
    const root = resolve(import.meta.dir, '..');
    const result = await queryDocumentReferences(root, query, direction === 'in' ? await documentPaths(root) : []);
    console.log(formatDocumentReferences(result, direction));
    for (const warning of result.warnings) console.error(warning);
    if (result.warnings.length) console.error('存在无法解析的链接，引用查询可能不完整；请用 docs:check 检查。');
  } catch (error) {
    console.error(`引用查询失败：${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
