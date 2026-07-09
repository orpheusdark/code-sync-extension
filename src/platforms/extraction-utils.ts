/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
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

/**
 * Reads code directly from the Monaco editor model API.
 * This avoids DOM scraping which is unreliable due to virtualisation.
 * Monaco only renders visible lines in the DOM; the model contains all lines in order.
 */
export function readMonacoModelValue(): string {
  try {
    type MonacoEditor = {
      getModels?: () => Array<{ getValue?: () => string; getLanguageId?: () => string }>;
      getEditors?: () => Array<{ getValue?: () => string }>;
    };
    type MonacoWindow = Window & { monaco?: { editor?: MonacoEditor } };
    const w = window as MonacoWindow;
    const monacoEditor = w.monaco?.editor;
    if (!monacoEditor) {
      return '';
    }

    // Try models first — each open file is a model
    const models = monacoEditor.getModels?.() ?? [];
    for (const model of models) {
      const value = model.getValue?.()?.trim() ?? '';
      if (looksLikeSolutionCode(value)) {
        return value;
      }
    }

    // Try editor instances
    const editors = monacoEditor.getEditors?.() ?? [];
    for (const editor of editors) {
      const value = editor.getValue?.()?.trim() ?? '';
      if (looksLikeSolutionCode(value)) {
        return value;
      }
    }
  } catch {
    // Monaco API not available
  }

  return '';
}

/**
 * Extracts code from the page using the Monaco editor API first (correct order),
 * then falls back to CodeMirror content and textarea elements.
 *
 * IMPORTANT: Do NOT use .view-lines .view-line DOM scraping — Monaco virtualizes
 * and positions lines with CSS `top`, so DOM order does not match source order.
 */
export function extractCodeFromDocument(): string {
  // 1. Monaco editor API — reads directly from the model (correct order, all lines)
  const monacoCode = readMonacoModelValue();
  if (monacoCode) {
    return monacoCode;
  }

  // 2. CodeMirror content (non-virtualised, used by some platforms)
  const cmCandidate = readCodeCandidate('.cm-content');
  if (looksLikeSolutionCode(cmCandidate)) {
    return cmCandidate;
  }

  // 3. Plain <textarea> value (direct access, no DOM scraping)
  const textareaValue = (document.querySelector('textarea') as HTMLTextAreaElement | null)?.value?.trim() ?? '';
  if (looksLikeSolutionCode(textareaValue)) {
    return textareaValue;
  }

  // 4. <pre><code> blocks (submission result pages)
  const preCandidate = readCodeCandidate('pre code');
  if (looksLikeSolutionCode(preCandidate)) {
    return preCandidate;
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
  return nodes
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
