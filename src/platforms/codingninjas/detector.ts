/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 *
 * Coding Ninjas / Code360 platform detector.
 */

const CN_SUCCESS_PATTERNS = /\b(correct|accepted|success|all test cases passed|perfect|100%|full score)\b/i;
const CN_FAILURE_PATTERNS = /\b(wrong answer|runtime error|time limit exceeded|compilation error|segmentation fault|memory limit exceeded|partially correct)\b/i;

const CN_RESULT_SELECTORS = [
  '[class*="result-status"]',
  '[class*="verdict"]',
  '[class*="submission-status"]',
  '[class*="status-text"]',
  '[class*="submission-result"]',
  '[class*="test-case-result"]',
  '.zen-notification-content', // specific to some modern UI toast
  '[class*="toast-content"]',
  '[class*="success-message"]'
];

const CN_SUCCESS_CLASS_SELECTORS = [
  '[class*="accepted"]',
  '[class*="success"]',
  '[class*="correct"]',
  '.result-status-accepted',
  '.status-accepted',
  '[class*="score"][class*="full"]'
];

export function isCodingNinjasProblemPage(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  const isCodingNinjas = /(?:^|\.)codingninjas\.com$/.test(hostname);
  const isNaukri = /(?:^|\.)naukri\.com$/.test(hostname);

  if (!isCodingNinjas && !isNaukri) {
    return false;
  }

  // CodeStudio path: /codestudio/problems/... or /studio/problems/...
  // Naukri Code360 path: /code360/problems/...
  // Some problem paths might be directly /problems/...
  return /\/(codestudio|studio|code360)?\/?problems\/.+/.test(pathname);
}

function hasSuccessClassElement(): boolean {
  for (const selector of CN_SUCCESS_CLASS_SELECTORS) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

function readResultElementText(): string {
  for (const selector of CN_RESULT_SELECTORS) {
    try {
      for (const element of document.querySelectorAll(selector)) {
        const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (!text || text.length > 800) {
          continue;
        }

        if (CN_SUCCESS_PATTERNS.test(text) || CN_FAILURE_PATTERNS.test(text)) {
          return text;
        }
      }
    } catch {
      // ignore
    }
  }
  return '';
}

function checkCodingNinjasAccepted(): boolean {
  if (hasSuccessClassElement()) {
    return true;
  }

  const resultText = readResultElementText();
  if (resultText) {
    return CN_SUCCESS_PATTERNS.test(resultText) && !CN_FAILURE_PATTERNS.test(resultText);
  }

  return false;
}

function hasFailureElementOrText(): boolean {
  const resultText = readResultElementText();
  if (resultText && CN_FAILURE_PATTERNS.test(resultText)) {
    return true;
  }
  
  return false;
}

export async function isCodingNinjasAcceptedSubmission(): Promise<boolean> {
  return checkCodingNinjasAccepted();
}
