/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */

import type { SubmissionPayload } from '../../shared/types';
import {
  extractSlugFromPathname,
  looksLikeSolutionCode,
  readMonacoModelValue
} from '../extraction-utils';

const CN_LANGUAGE_SELECTORS = [
  '[class*="language-selector"]',
  '[class*="language-dropdown"]',
  '[class*="select-lang"]',
  'select',
  '[class*="language"]'
];

function readLanguageFromSelector(): string {
  for (const selector of CN_LANGUAGE_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        let text = '';
        if (element instanceof HTMLSelectElement) {
          text = element.options[element.selectedIndex]?.text?.trim() ?? '';
        } else {
          text = element.textContent?.trim() ?? '';
        }
        
        // Ensure it's a short string resembling a language
        if (text && text.length > 0 && text.length <= 30 && !text.includes('\n')) {
          return text;
        }
      }
    } catch {
      // ignore
    }
  }
  return 'Unknown';
}

function extractCodingNinjasLanguage(): string {
  const fromSelector = readLanguageFromSelector();
  if (fromSelector && fromSelector !== 'Unknown') {
    return fromSelector;
  }
  return 'Unknown';
}

function extractCodingNinjasCode(): string {
  // 1. Monaco editor API (most likely)
  const fromMonaco = readMonacoModelValue();
  if (fromMonaco && looksLikeSolutionCode(fromMonaco)) {
    return fromMonaco;
  }

  // 2. Monaco DOM fallback (view-lines)
  const lineElements = document.querySelectorAll('.monaco-editor .view-lines .view-line');
  if (lineElements.length > 0) {
    const code = Array.from(lineElements)
      .map((line) => line.textContent ?? '')
      .join('\n')
      .trim();

    if (looksLikeSolutionCode(code)) {
      return code;
    }
  }

  // 3. Fallback to textarea
  const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[];
  for (const textarea of textareas) {
    const code = textarea.value?.trim() ?? '';
    if (looksLikeSolutionCode(code)) {
      return code;
    }
  }

  return '';
}

function extractCodingNinjasTitle(): string {
  const headingSelectors = [
    'h1',
    '[class*="problem-title"] h1',
    '[class*="problem-name"]',
    '[class*="title-text"]'
  ];

  for (const selector of headingSelectors) {
    const text = document.querySelector(selector)?.textContent?.trim() ?? '';
    if (text && text.length > 0 && text.length < 200) {
      return cleanTitle(text);
    }
  }

  const docTitle = cleanTitle(document.title);
  if (docTitle) {
    return docTitle;
  }

  const slug = extractSlugFromPathname(window.location.pathname);
  if (slug) {
    return slug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return 'Coding Ninjas Problem';
}

function cleanTitle(value: string): string {
  return value
    .replace(/\s*[|\-–]\s*Coding Ninjas.*$/i, '')
    .replace(/\s*[|\-–]\s*CodeStudio.*$/i, '')
    .replace(/\s*[|\-–]\s*Naukri.*$/i, '')
    .replace(/\s*[|\-–]\s*Code360.*$/i, '')
    .replace(/^\d+[.):\-]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCodingNinjasDifficulty(): string | undefined {
  const selectors = [
    '[class*="difficulty"]',
    '[class*="level-container"]'
  ];
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim() ?? '';
    if (text.match(/easy|medium|hard/i)) {
      return text.match(/easy|medium|hard/i)![0];
    }
  }
  return undefined;
}

export function extractCodingNinjasSubmission(): SubmissionPayload | null {
  const code = extractCodingNinjasCode();
  if (!code) {
    return null;
  }

  const title = extractCodingNinjasTitle();
  const slug = extractSlugFromPathname(window.location.pathname) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const language = extractCodingNinjasLanguage();
  const difficulty = extractCodingNinjasDifficulty();

  return {
    platform: 'codingninjas',
    title: title || slug || 'Coding Ninjas Problem',
    slug,
    language,
    code,
    difficulty,
    url: window.location.href,
    submittedAt: new Date().toISOString(),
    source: 'codingninjas',
    problemId: slug || undefined
  };
}
