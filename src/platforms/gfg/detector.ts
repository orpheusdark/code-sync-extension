/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
export function isGfgProblemPage(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  if (!/^(www\.|practice\.)?geeksforgeeks\.org$/.test(hostname)) {
    return false;
  }

  return /^\/problems\/[^/]+/.test(pathname);
}

const GFG_RESULT_SELECTORS = [
  '.result__status--accepted',
  '.verdict-accepted',
  '[class*="result__status"]',
  '[class*="submission"][class*="result"]',
  '[class*="judge"][class*="result"]',
  '[class*="verdict"]',
  '[class*="JudgeResult"]',
  '[data-testid*="result"]',
  '[data-testid*="submission"]',
  '[role="alert"]',
  '[role="status"]'
];

const SUCCESS_PATTERN = /\b(accepted|correct answer|all test cases passed|problem solved successfully|successfully solved|passed all test cases|output:\s*correct)\b/i;
const FAILURE_PATTERN = /\b(wrong answer|runtime error|time limit exceeded|compilation error|memory limit exceeded|internal error|presentation error)\b/i;

function readSubmissionResultText(): string {
  for (const selector of GFG_RESULT_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!text || text.length > 500) {
        continue;
      }

      if (SUCCESS_PATTERN.test(text) || FAILURE_PATTERN.test(text)) {
        return text;
      }
    }
  }

  return '';
}

function hasVisibleSuccessBanner(): boolean {
  const bannerSelectors = [
    '[class*="success"]',
    '[class*="accepted"]',
    '[class*="correct"]',
    '[class*="passed"]'
  ];

  for (const selector of bannerSelectors) {
    for (const element of document.querySelectorAll(selector)) {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!text || text.length > 180) {
        continue;
      }

      if (SUCCESS_PATTERN.test(text) && !FAILURE_PATTERN.test(text)) {
        return true;
      }
    }
  }

  return false;
}

function hasSuccessfulTestCaseSummary(): boolean {
  const rows = Array.from(document.querySelectorAll('tr, li, div, span, p'));
  let passedCount = 0;

  for (const row of rows) {
    const text = row.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!text || text.length > 120) {
      continue;
    }

    if (/^\d+\s*\/\s*\d+\s*test cases passed$/i.test(text) || /^all test cases passed$/i.test(text)) {
      return true;
    }

    if (/test case passed|passed$/i.test(text) && !FAILURE_PATTERN.test(text)) {
      passedCount += 1;
      if (passedCount >= 2) {
        return true;
      }
    }
  }

  return false;
}

export function isGfgAcceptedSubmission(): boolean {
  if (document.querySelector('.result__status--accepted, .verdict-accepted')) {
    return true;
  }

  const resultText = readSubmissionResultText();
  if (resultText) {
    return SUCCESS_PATTERN.test(resultText) && !FAILURE_PATTERN.test(resultText);
  }

  if (hasVisibleSuccessBanner() || hasSuccessfulTestCaseSummary()) {
    return true;
  }

  // Do not scan the full page body: problem statements mention "compilation error"
  // and other failure terms, which caused false negatives after successful submissions.
  return false;
}
