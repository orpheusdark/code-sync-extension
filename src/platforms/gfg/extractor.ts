import type { SubmissionPayload } from '../../shared/types';
import {
  extractLanguageFromDocument,
  extractSlugFromPathname,
  extractTextBySelectors,
  looksLikeSolutionCode
} from '../extraction-utils';

const GFG_LANGUAGE_SELECTORS = [
  '[data-testid="language-selector"] button',
  '[aria-haspopup="listbox"]',
  'select',
  'button[class*="language"]'
];

const GFG_TITLE_SELECTORS = [
  'h1[class*="problem"]',
  '[class*="problem-title"]',
  '[class*="ProblemTitle"]',
  '[class*="problems_header"] h1',
  '[class*="problemTab"] h1',
  'h1'
];

const GFG_EDITOR_EXCLUDE_ANCESTORS = [
  '[class*="problem-statement"]',
  '[class*="ProblemDescription"]',
  '[class*="description"]',
  '[class*="editorial"]',
  '[class*="example"]',
  '[class*="discuss"]',
  '[class*="solution-tab"]',
  '[class*="article"]',
  'article',
  'header',
  'nav',
  'footer'
];

const GFG_CODING_EDITOR_SELECTORS = [
  '#practice-coding-div .monaco-editor',
  '[class*="coding"][class*="area"] .monaco-editor',
  '[class*="CodeEditor"] .monaco-editor',
  '[class*="editor-container"] .monaco-editor',
  '[class*="ide"] .monaco-editor',
  '[class*="practice"] .monaco-editor'
];

export function extractGfgSubmission(): SubmissionPayload | null {
  const code = extractGfgCode();
  if (!code) {
    return null;
  }

  const title = extractGfgTitle();
  const slug = extractSlugFromPathname(window.location.pathname);
  const languageCandidate = extractLanguageFromDocument(GFG_LANGUAGE_SELECTORS);
  const language = isLikelyLanguage(languageCandidate) ? languageCandidate : readLanguageFromBody();
  const difficulty = extractTextBySelectors([
    '[data-testid="difficulty"]',
    '[class*="difficulty"]'
  ]) || readDifficultyFromBody();
  const tags = extractTagsFromBody();

  return {
    platform: 'gfg',
    title,
    slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    language,
    code,
    difficulty: difficulty || undefined,
    url: window.location.href,
    tags: tags.length ? tags : undefined,
    submittedAt: new Date().toISOString(),
    source: 'gfg',
    problemId: slug || undefined
  };
}

function extractGfgTitle(): string {
  for (const selector of GFG_TITLE_SELECTORS) {
    const text = document.querySelector(selector)?.textContent?.trim() ?? '';
    const cleaned = cleanGfgTitle(text);
    if (cleaned) {
      return cleaned;
    }
  }

  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ?? '';
  const fromMeta = cleanGfgTitle(ogTitle);
  if (fromMeta) {
    return fromMeta;
  }

  const fromDocumentTitle = cleanGfgTitle(document.title);
  if (fromDocumentTitle) {
    return fromDocumentTitle;
  }

  const slug = extractSlugFromPathname(window.location.pathname);
  if (slug) {
    return slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return 'GFG Problem';
}

function cleanGfgTitle(value: string): string {
  return value
    .replace(/\s*\|\s*GeeksforGeeks.*$/i, '')
    .replace(/\s*-\s*GeeksforGeeks.*$/i, '')
    .replace(/\s*-\s*Practice.*$/i, '')
    .replace(/\s*\|\s*Practice.*$/i, '')
    .replace(/^\d+[.)\-:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readDifficultyFromBody(): string {
  const bodyText = document.body?.innerText ?? '';
  const match = bodyText.match(/Difficulty\s*[:\-]?\s*(Easy|Medium|Hard)/i);
  return match?.[1] ?? '';
}

function readLanguageFromBody(): string {
  const bodyText = document.body?.innerText ?? '';
  const knownLanguages = [
    'C++',
    'C',
    'Java',
    'Python',
    'Python3',
    'JavaScript',
    'Go',
    'Rust',
    'C#',
    'PHP',
    'Kotlin',
    'Swift'
  ];

  for (const language of knownLanguages) {
    const regex = new RegExp(`\\b${language.replace(/[#.+*?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(bodyText)) {
      return language;
    }
  }

  return 'Unknown';
}

function isLikelyLanguage(value: string): boolean {
  return /^(C\+\+|C|Java|Python3?|JavaScript|Go|Rust|C#|PHP|Kotlin|Swift)$/i.test(value.trim());
}

function extractTagsFromBody(): string[] {
  const possibleTags = Array.from(document.querySelectorAll('a, span, div'))
    .map((node) => node.textContent?.trim() ?? '')
    .filter((text) => /^#[\w\s-]{2,40}$/.test(text) || /^(array|string|tree|graph|dynamic programming|greedy|recursion|linked list|stack|queue|binary tree|hash|backtracking|math)$/i.test(text));

  return Array.from(new Set(possibleTags.map((tag) => tag.replace(/^#/, '').trim())));
}

function extractGfgCode(): string {
  const submissionCode = extractSubmittedSolutionCode();
  if (submissionCode) {
    return submissionCode;
  }

  const monacoCode = pickBestMonacoEditorCode();
  if (monacoCode) {
    return monacoCode;
  }

  const aceCode = readAceEditorCode();
  if (aceCode) {
    return aceCode;
  }

  const scopedSelectors = [
    '[class*="submission"] pre code',
    '[class*="submitted"] pre code',
    '[class*="result"] pre code',
    '[class*="coding"] textarea',
    '[class*="editor"] textarea',
    'textarea'
  ];

  for (const selector of scopedSelectors) {
    if (selector.includes('textarea')) {
      const textareas = Array.from(document.querySelectorAll(selector)) as HTMLTextAreaElement[];
      for (const textarea of textareas) {
        const value = textarea.value?.trim() ?? '';
        if (looksLikeSolutionCode(value) && !isInsideExcludedArea(textarea)) {
          return value;
        }
      }
      continue;
    }

    const nodes = Array.from(document.querySelectorAll(selector));
    for (const node of nodes) {
      if (isInsideExcludedArea(node)) {
        continue;
      }

      const code = node.textContent?.trim() ?? '';
      if (looksLikeSolutionCode(code)) {
        return code;
      }
    }
  }

  return '';
}

function extractSubmittedSolutionCode(): string {
  const submissionSelectors = [
    '[class*="submission"] .monaco-editor',
    '[class*="submitted"] .monaco-editor',
    '[class*="result"] .monaco-editor',
    '[class*="verdict"] .monaco-editor',
    '[class*="JudgeResult"] .monaco-editor'
  ];

  for (const selector of submissionSelectors) {
    const editors = Array.from(document.querySelectorAll(selector));
    for (const editor of editors) {
      const code = readMonacoEditorText(editor);
      if (looksLikeSolutionCode(code)) {
        return code;
      }
    }
  }

  return '';
}

function pickBestMonacoEditorCode(): string {
  for (const selector of GFG_CODING_EDITOR_SELECTORS) {
    const editor = document.querySelector(selector);
    if (!editor) {
      continue;
    }

    const code = readMonacoEditorText(editor);
    if (looksLikeSolutionCode(code) && !isStarterTemplate(code)) {
      return code;
    }
  }

  const editors = Array.from(document.querySelectorAll('.monaco-editor'));
  const candidates: Array<{ code: string; score: number }> = [];

  for (const editor of editors) {
    if (isInsideExcludedArea(editor)) {
      continue;
    }

    if (!isEditableMonacoEditor(editor)) {
      continue;
    }

    const code = readMonacoEditorText(editor);
    if (!looksLikeSolutionCode(code) || isStarterTemplate(code)) {
      continue;
    }

    let score = code.length;

    if (editor.closest('[class*="submission"], [class*="submitted"], [class*="result"], [class*="verdict"]')) {
      score += 20_000;
    }

    if (editor.closest('[class*="coding"], [class*="CodeEditor"], [class*="editor-container"], [class*="practice"], [class*="ide"]')) {
      score += 10_000;
    }

    if (editor.closest('[class*="solution"]')) {
      score += 8_000;
    }

    if (editor.classList.contains('focused') || editor.querySelector('.focused')) {
      score += 5_000;
    }

    candidates.push({ code, score });
  }

  if (candidates.length === 0) {
    return '';
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].code;
}

function readMonacoEditorText(editor: Element): string {
  const textarea = editor.querySelector('textarea.inputarea') as HTMLTextAreaElement | null;
  const fromTextarea = textarea?.value?.trim() ?? '';
  if (fromTextarea) {
    return fromTextarea;
  }

  const lines = editor.querySelectorAll('.view-lines .view-line');
  return Array.from(lines)
    .map((line) => line.textContent ?? '')
    .join('\n')
    .trim();
}

function readAceEditorCode(): string {
  const editors = Array.from(document.querySelectorAll('.ace_editor'));
  const candidates: Array<{ code: string; score: number }> = [];

  for (const editor of editors) {
    if (isInsideExcludedArea(editor)) {
      continue;
    }

    const lines = editor.querySelectorAll('.ace_line');
    const code = Array.from(lines)
      .map((line) => line.textContent ?? '')
      .join('\n')
      .trim();

    if (!looksLikeSolutionCode(code) || isStarterTemplate(code)) {
      continue;
    }

    let score = code.length;
    if (editor.closest('[class*="coding"], [class*="editor"], [class*="practice"]')) {
      score += 10_000;
    }

    candidates.push({ code, score });
  }

  if (candidates.length === 0) {
    return '';
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].code;
}

function isInsideExcludedArea(element: Element): boolean {
  return GFG_EDITOR_EXCLUDE_ANCESTORS.some((selector) => element.closest(selector));
}

function isEditableMonacoEditor(editor: Element): boolean {
  const textarea = editor.querySelector('textarea.inputarea') as HTMLTextAreaElement | null;
  if (textarea?.readOnly || textarea?.disabled) {
    return false;
  }

  return editor.getAttribute('data-mode') !== 'readonly';
}

function isStarterTemplate(code: string): boolean {
  const normalized = code.trim();
  if (!normalized) {
    return true;
  }

  const starterPatterns = [
    /^\/\/\s*your code here$/im,
    /^#\s*your code here$/im,
    /^\/\*\s*your code here\s*\*\/$/im,
    /^class\s+Solution\s*\{\s*\}$/,
    /^public\s+class\s+Solution\s*\{\s*\}$/,
    /^def\s+solution\s*\(\s*\)\s*:\s*pass\s*$/,
    /^#\s*code here\s*$/im
  ];

  return starterPatterns.some((pattern) => pattern.test(normalized));
}
