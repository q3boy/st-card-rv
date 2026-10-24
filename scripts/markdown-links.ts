import { dirname, isAbsolute, relative, resolve } from 'node:path';

export interface LinkIssue {
  source: string;
  line: number;
  href: string;
  reason: string;
}

/** Use the same error table for working-tree documents and generated packages. */
export function formatLinkIssues(issues: LinkIssue[]): string {
  if (!issues.length) return '';
  const cell = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .replace(/`/g, '\\`')
      .replace(/\r?\n/g, '<br>');
  return [
    '| 来源文件 | 目标 | 错误说明 |',
    '| --- | --- | --- |',
    ...issues.map(issue => `| ${[`${issue.source}:${issue.line}`, issue.href, issue.reason].map(cell).join(' | ')} |`),
    '',
  ].join('\n');
}

/** Keep offsets and line numbers while excluding fenced examples from checks. */
function prose(markdown: string): string {
  let fence: { character: string; length: number } | undefined;
  return markdown
    .split('\n')
    .map(line => {
      const marker = line.replace(/\r$/, '').match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim())
          fence = undefined;
        return line.replace(/./g, ' ');
      }
      if (!marker) return line;
      fence = { character: marker[1][0], length: marker[1].length };
      return line.replace(/./g, ' ');
    })
    .join('\n');
}

export interface MarkdownSection {
  title: string;
  anchor: string;
  level: number;
  line: number;
  endLine: number;
}

/** Shared heading slugs and ranges; a section includes its subordinate headings. */
export function markdownSections(markdown: string): MarkdownSection[] {
  const result: MarkdownSection[] = [];
  const counts = new Map<string, number>();
  const body = prose(markdown);
  const lines = body.split('\n');
  for (const [index, text] of lines.entries()) {
    const match = text.replace(/\r$/, '').match(/^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/);
    if (!match) continue;
    const slug = match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '')
      .replace(/\s/g, '-');
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    result.push({
      title: match[2],
      anchor: count ? `${slug}-${count}` : slug,
      level: match[1].length,
      line: index + 1,
      endLine: lines.length,
    });
  }
  for (const [index, section] of result.entries()) {
    section.endLine = (result.slice(index + 1).find(next => next.level <= section.level)?.line ?? lines.length + 1) - 1;
  }
  const explicit = [...body.matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["']([^"']+)["']/gi)].map(match => {
    const line = body.slice(0, match.index).split('\n').length;
    const owner = result.filter(section => section.line <= line).at(-1);
    return {
      title: owner?.title ?? '(文档开头)',
      anchor: match[1],
      level: owner?.level ?? 0,
      line,
      endLine: owner?.endLine ?? (result[0]?.line ?? lines.length + 1) - 1,
    };
  });
  return [...result, ...explicit].sort((a, b) => a.line - b.line);
}

/** Shared with release-package validation; duplicate headings get -1, -2, etc. */
export function markdownAnchors(markdown: string): Set<string> {
  return new Set(markdownSections(markdown).map(section => section.anchor));
}

/** Resolve links independently of target existence, so old paths and anchors remain queryable. */
export function localMarkdownTarget(root: string, source: string, href: string) {
  if (/^(?!file:|[a-z]:[\\/])(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return undefined;
  const [pathAndQuery, fragment = ''] = href.split('#', 2);
  const path = decodeURIComponent(pathAndQuery.split('?')[0]);
  if (/^(?:file:|[a-z]:[\\/])/i.test(href) || isAbsolute(path) || path.includes('\\'))
    throw new Error('应使用相对路径，不能引用本机或绝对路径');
  const absolute = path ? resolve(root, dirname(source), path) : resolve(root, source);
  const inside = relative(resolve(root), absolute);
  if (inside === '..' || inside.startsWith('../') || inside.startsWith('..\\') || isAbsolute(inside))
    throw new Error('链接超出仓库');
  return { path: inside.replace(/\\/g, '/'), anchor: decodeURIComponent(fragment) };
}

/** Resolve reference-style links at their use sites, rather than at the definition's chapter. */
export function markdownReferences(markdown: string): { href: string; line: number }[] {
  const body = prose(markdown).replace(/(`+)[^`]*?\1/g, match => match.replace(/[^\n]/g, ' '));
  const definitions = new Map<string, string>();
  const normalize = (label: string) => label.trim().replace(/\s+/g, ' ').toLowerCase();
  const withoutDefinitions = body.replace(
    /^[ \t]{0,3}\[([^\]\n]+)\]:[ \t]*(<[^>\n]+>|\S+)[^\n]*$/gm,
    (match, label: string, href: string) => {
      const key = normalize(label);
      if (!definitions.has(key)) definitions.set(key, href.startsWith('<') ? href.slice(1, -1) : href);
      return match.replace(/[^\n]/g, ' ');
    },
  );
  const result = markdownLinks(withoutDefinitions);
  for (const match of withoutDefinitions.matchAll(/!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g)) {
    if (withoutDefinitions[match.index - 1] === '\\' || withoutDefinitions[match.index + match[0].length] === '(')
      continue;
    const href = definitions.get(normalize(match[2] || match[1]));
    if (href !== undefined) result.push({ href, line: withoutDefinitions.slice(0, match.index).split('\n').length });
  }
  result.sort((a, b) => a.line - b.line);
  return result;
}

export function markdownLinks(markdown: string): { href: string; line: number }[] {
  // Inline code can contain example links; mask it without changing source offsets.
  const body = prose(markdown).replace(/(`+)[^`]*?\1/g, match => match.replace(/[^\n]/g, ' '));
  const links = [
    ...body.matchAll(/\]\([ \t]*(<[^>\n]+>|(?:[^\s()]|\([^()]*\))+)(?:[ \t]+["'][^\n]*?["'])?[ \t]*\)/g),
    ...body.matchAll(/^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]+>|\S+)/gm),
    ...body.matchAll(/<(?:a|img)\b[^>]*\b(?:href|src)=["']([^"']+)["']/gi),
  ];
  return links
    .sort((a, b) => a.index - b.index)
    .map(link => ({
      href: link[1].startsWith('<') ? link[1].slice(1, -1) : link[1],
      line: body.slice(0, link.index).split('\n').length,
    }));
}
