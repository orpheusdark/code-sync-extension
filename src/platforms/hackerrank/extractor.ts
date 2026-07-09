/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
/**
 * HackerRank solution extractor.
 *
 * HackerRank's code editor is CodeMirror (primary) or, on newer contest pages,
 * a Monaco-like editor. Code extraction is attempted in the following order:
 *   1. CodeMirror API via window.cm (HackerRank exposes this globally)
 *   2. CodeMirror DOM (.CodeMirror-code lines)
 *   3. Monaco editor textarea / view-lines
 *   4. <textarea> fallback
 *
 * Language detection sources (priority order):
 *   1. window.__pageData (HackerRank injects page data here)
 *   2. Language selector button text
 *   3. URL path segment (e.g. /languages/python3)
 *   4. Active editor DOM class (e.g. cm-python, cm-javascript)
 *
 * Category/domain for subfolder:
 *   Extracted from the URL path. e.g.:
 *     /domains/algorithms/challenges/two-strings → 'algorithms'
 *     /challenges/two-strings                   → null (no subfolder)
 *     /contests/my-contest/challenges/...       → null
 */

import type { SubmissionPayload } from '../../shared/types';
import {
  extractProblemTitleFromDocument,
  extractSlugFromPathname,
  looksLikeSolutionCode,
  readMonacoModelValue
} from '../extraction-utils';

// Language selector selectors specific to HackerRank
const HR_LANGUAGE_SELECTORS = [
  // Primary: the language dropdown button label
  '[class*="dropdown-label"]',
  '[class*="language-dropdown"] [class*="selected"]',
  '[class*="lang-select"] button',
  '[data-analytics*="language"] button',
  'select[name="language"]',
  'select[id*="language"]',
  // Generic fallbacks
  'button[class*="language"]',
  '[class*="language-selector"] button'
];

// CodeMirror mode→ language map for DOM-based detection
const CM_MODE_TO_LANGUAGE: Record<string, string> = {
  'python': 'python3',
  'text/x-python': 'python3',
  'javascript': 'javascript',
  'text/javascript': 'javascript',
  'text/typescript': 'typescript',
  'text/x-java': 'java',
  'text/x-c++src': 'cpp',
  'text/x-csrc': 'c',
  'text/x-csharp': 'c#',
  'text/x-ruby': 'ruby',
  'text/x-go': 'go',
  'text/x-rustsrc': 'rust',
  'text/x-kotlin': 'kotlin',
  'text/x-scala': 'scala',
  'text/x-php': 'php',
  'text/x-swift': 'swift',
  'text/x-perl': 'perl',
  'application/x-sh': 'bash',
  'text/x-haskell': 'haskell',
  'text/x-erlang': 'erlang',
  'text/x-elixir': 'elixir'
};

// Regex patterns for domain extraction from HackerRank URLs
// /domains/algorithms/challenges/two-strings → 'algorithms'
const DOMAIN_PATH_PATTERN = /\/domains\/([^/]+)\//;
const TRACK_PATH_PATTERN = /\/tracks\/([^/]+)\//;

interface HackerRankPageData {
  language?: string;
  languageSlug?: string;
  langSlug?: string;
  challenge?: {
    slug?: string;
    name?: string;
    track?: { slug?: string; name?: string };
  };
}

/** Read the language from HackerRank's injected window.__pageData */
function readLanguageFromPageData(): string {
  try {
    type HRWindow = Window & { __pageData?: HackerRankPageData };
    const pageData = (window as HRWindow).__pageData;
    if (pageData) {
      const lang = pageData.language || pageData.languageSlug || pageData.langSlug;
      if (lang && typeof lang === 'string') {
        return lang.trim();
      }
    }
  } catch { /* continue */ }

  return '';
}

/** Read the language from the visible language selector button */
function readLanguageFromSelector(): string {
  for (const selector of HR_LANGUAGE_SELECTORS) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim() ?? '';
    if (text && text.length > 0 && text.length <= 50) {
      return text;
    }

    // Handle <select> elements
    if (element instanceof HTMLSelectElement) {
      const selected = element.options[element.selectedIndex]?.text?.trim() ?? '';
      if (selected) {
        return selected;
      }
    }
  }

  return '';
}

/** Detect language from CodeMirror DOM class (e.g. cm-python, cm-javascript) */
function readLanguageFromEditorClass(): string {
  const editor = document.querySelector('.CodeMirror');
  if (!editor) {
    return '';
  }

  // CodeMirror stores the mode as a data-mode attribute or as a class
  const modeAttr = editor.getAttribute('data-mode') ?? '';
  if (modeAttr && CM_MODE_TO_LANGUAGE[modeAttr]) {
    return CM_MODE_TO_LANGUAGE[modeAttr];
  }

  // Some versions expose it as cm-mode class
  for (const cls of Array.from(editor.classList)) {
    if (cls.startsWith('cm-mode-')) {
      const mode = cls.replace('cm-mode-', '');
      if (CM_MODE_TO_LANGUAGE[mode]) {
        return CM_MODE_TO_LANGUAGE[mode];
      }
    }
  }

  // Try the CodeMirror instance's mode property via the DOM
  type CMElement = Element & { CodeMirror?: { getMode?: () => { name?: string } } };
  const cmMode = (editor as CMElement).CodeMirror?.getMode?.()?.name ?? '';
  if (cmMode && CM_MODE_TO_LANGUAGE[cmMode]) {
    return CM_MODE_TO_LANGUAGE[cmMode];
  }

  return '';
}

/** Extract language using all available sources in priority order */
function extractHackerRankLanguage(): string {
  // 1. window.__pageData (most reliable — server-injected)
  const fromPageData = readLanguageFromPageData();
  if (fromPageData) {
    return fromPageData;
  }

  // 2. Visible language selector UI
  const fromSelector = readLanguageFromSelector();
  if (fromSelector) {
    return fromSelector;
  }

  // 3. CodeMirror editor class / instance
  const fromEditorClass = readLanguageFromEditorClass();
  if (fromEditorClass) {
    return fromEditorClass;
  }

  return 'Unknown';
}

/** Read code from CodeMirror via the global window.cm API (HackerRank exposes this) */
function readCodeFromCMApi(): string {
  try {
    type CMWindow = Window & { cm?: { getValue?: () => string } };
    const cm = (window as CMWindow).cm;
    if (cm?.getValue) {
      const code = cm.getValue().trim();
      if (looksLikeSolutionCode(code)) {
        return code;
      }
    }
  } catch { /* continue */ }

  return '';
}

/** Read code from CodeMirror's rendered DOM lines */
function readCodeFromCMDom(): string {
  // Try the CodeMirror textarea first (most accurate)
  const cmTextarea = document.querySelector('.CodeMirror textarea') as HTMLTextAreaElement | null;
  if (cmTextarea?.value?.trim()) {
    const code = cmTextarea.value.trim();
    if (looksLikeSolutionCode(code)) {
      return code;
    }
  }

  // Fall back to rendered view-lines
  const lineElements = document.querySelectorAll('.CodeMirror-code .CodeMirror-line');
  if (lineElements.length > 0) {
    const code = Array.from(lineElements)
      .map((line) => line.textContent ?? '')
      .join('\n')
      .trim();

    if (looksLikeSolutionCode(code)) {
      return code;
    }
  }

  return '';
}

/** Extract the submitted solution code using all available methods */
function extractHackerRankCode(): string {
  // 1. Monaco editor API (newest HackerRank editor)
  const fromMonaco = readMonacoModelValue();
  if (fromMonaco) {
    return fromMonaco;
  }

  // 2. CodeMirror global API (older HackerRank editor)
  const fromCMApi = readCodeFromCMApi();
  if (fromCMApi) {
    return fromCMApi;
  }

  // 3. LocalStorage draft check (HackerRank saves drafts)
  const fromLocalStorage = readCodeFromLocalStorage();
  if (fromLocalStorage) {
    return fromLocalStorage;
  }

  // 4. CodeMirror DOM fallback
  const fromCMDom = readCodeFromCMDom();
  if (fromCMDom) {
    return fromCMDom;
  }

  // 5. Plain <textarea> fallback
  const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[];
  for (const textarea of textareas) {
    const code = textarea.value?.trim() ?? '';
    if (looksLikeSolutionCode(code)) {
      return code;
    }
  }

  return '';
}

/** Check local storage for the saved draft which holds the exact code */
function readCodeFromLocalStorage(): string {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('hackerrank') && key.includes('draft')) {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          // drafts are often stored like { "code": "..." } or { "body": "..." }
          const code = parsed?.code || parsed?.body || parsed?.source;
          if (typeof code === 'string' && looksLikeSolutionCode(code)) {
            return code;
          }
        }
      }
    }
  } catch { /* continue */ }
  return '';
}

/** Extract the problem title from the page */
function extractHackerRankTitle(): string {
  // 1. HackerRank challenge heading
  const headingSelectors = [
    '[class*="challenge-header"] h1',
    '[class*="challenge-name"]',
    '[class*="problem-title"] h1',
    'h1[class*="challenge"]',
    '.challenge-text-title',
    '.challenge-header h1',
    'h1'
  ];

  for (const selector of headingSelectors) {
    const text = document.querySelector(selector)?.textContent?.trim() ?? '';
    if (text && text.length > 0 && text.length < 200) {
      return cleanHackerRankTitle(text);
    }
  }

  // 2. Open Graph meta title
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ?? '';
  if (ogTitle) {
    return cleanHackerRankTitle(ogTitle);
  }

  // 3. Document title
  const docTitle = cleanHackerRankTitle(document.title);
  if (docTitle) {
    return docTitle;
  }

  // 4. Slug from URL
  const slug = extractHackerRankSlug();
  if (slug) {
    return slug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return 'HackerRank Problem';
}

function cleanHackerRankTitle(value: string): string {
  return value
    .replace(/\s*[|\-–]\s*HackerRank.*$/i, '')
    .replace(/\s*-\s*Problem Solving.*$/i, '')
    .replace(/\s*-\s*Practice.*$/i, '')
    .replace(/^\d+[.):\-]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the challenge slug from the URL path */
function extractHackerRankSlug(): string {
  const pathname = window.location.pathname;
  // /challenges/two-strings/problem → 'two-strings'
  const challengeMatch = pathname.match(/\/challenges\/([^/]+)/);
  if (challengeMatch?.[1]) {
    return challengeMatch[1];
  }

  return extractSlugFromPathname(pathname);
}

/**
 * Determine the HackerRank domain/category from the URL path.
 * Returns a slug like 'algorithms' or 'data-structures' which the sync
 * service converts to a folder name like 'Algorithms' or 'Data Structures'.
 * Returns null when no domain can be detected.
 */
function extractHackerRankDomain(): string | null {
  const pathname = window.location.pathname;

  // /domains/algorithms/challenges/... → 'algorithms'
  const domainMatch = pathname.match(DOMAIN_PATH_PATTERN);
  if (domainMatch?.[1]) {
    return domainMatch[1].toLowerCase();
  }

  // /tracks/data-structures/... → 'data-structures'
  const trackMatch = pathname.match(TRACK_PATH_PATTERN);
  if (trackMatch?.[1]) {
    return trackMatch[1].toLowerCase();
  }

  return null;
}

export function extractHackerRankSubmission(): SubmissionPayload | null {
  const code = extractHackerRankCode();
  if (!code) {
    return null;
  }

  const title = extractHackerRankTitle();
  const slug = extractHackerRankSlug();
  const language = extractHackerRankLanguage();
  const domain = extractHackerRankDomain();

  // Build a source string that encodes the domain for folder resolution in sync.ts
  // e.g. 'hackerrank-algorithms' → folder 'Algorithms'
  const source = domain ? `hackerrank-${domain}` : 'hackerrank';

  return {
    platform: 'hackerrank',
    title: title || slug || 'HackerRank Problem',
    slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    language,
    code,
    url: window.location.href,
    submittedAt: new Date().toISOString(),
    source,
    problemId: slug || undefined
  };
}
