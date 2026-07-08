export function extractTextBySelectors(selectors: string[], maxLength = 80): string {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim() ?? '';
    if (text && text.length <= maxLength) {
      return text;
    }
  }

  return '';
}

export function extractProblemTitleFromDocument(stripSuffixes: string[] = []): string {
  const candidates = [
    document.querySelector('h1')?.textContent?.trim() ?? '',
    document.querySelector('[data-cy="question-title"]')?.textContent?.trim() ?? '',
    document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ?? '',
    document.title.trim()
  ];

  for (const candidate of candidates) {
    const cleaned = cleanupTitle(candidate, stripSuffixes);
    if (cleaned) {
      return cleaned;
    }
  }

  return '';
}

export function extractSlugFromPathname(pathname: string, pattern = /\/problems\/([^/]+)/): string {
  return decodeURIComponent(pathname.match(pattern)?.[1] ?? '').trim();
}

export function extractCodeFromDocument(): string {
  const editorSelectors = [
    '.monaco-editor .view-lines .view-line',
    '.cm-content',
    '[contenteditable="true"]',
    'textarea',
    'pre code'
  ];

  for (const selector of editorSelectors) {
    const candidate = readCodeCandidate(selector);
    if (looksLikeSolutionCode(candidate)) {
      return candidate;
    }
  }

  return '';
}

export function extractLanguageFromDocument(selectors: string[], fallback = 'Unknown'): string {
  const language = extractTextBySelectors(selectors, 40);
  return language || fallback;
}

export function looksLikeSolutionCode(code: string): boolean {
  const normalized = code.trim();
  if (!normalized || normalized.length < 12) {
    return false;
  }

  if (/^[\d\s,.;:+\-*/()\[\]{}=<>|&'"`_]+$/.test(normalized)) {
    return false;
  }

  return /(^|\n)\s*(class\s+\w+|def\s+\w+\s*\(|function\s+\w+\s*\(|public\s+(class|static|void)|private\s+(class|static|void)|#include\s*<|using\s+namespace\s+std|package\s+main|var\s+\w+|let\s+\w+|const\s+\w+|if\s+__name__\s*==\s*['"]__main__['"])/.test(normalized) || /[{};]/.test(normalized) || /\breturn\b/.test(normalized);
}

function cleanupTitle(value: string, stripSuffixes: string[]): string {
  let title = value.replace(/\s*[-|–—]\s*(LeetCode|GeeksforGeeks|Practice).*$/i, '').trim();
  for (const suffix of stripSuffixes) {
    title = title.replace(new RegExp(`\\s*${escapeRegExp(suffix)}\\s*$`, 'i'), '').trim();
  }

  return title.replace(/^\d+[.)\-:]\s*/, '').trim();
}

function readCodeCandidate(selector: string): string {
  const nodes = Array.from(document.querySelectorAll(selector));
  if (selector === 'textarea') {
    return (document.querySelector('textarea') as HTMLTextAreaElement | null)?.value?.trim() ?? '';
  }

  return nodes
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
