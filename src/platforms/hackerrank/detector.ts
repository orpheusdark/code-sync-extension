/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 *
 * HackerRank platform detector.
 *
 * HackerRank is a React SPA. Submission results appear asynchronously after
 * the judge finishes. We use multiple detection strategies:
 *
 *   1. Visible green status elements / success icons
 *   2. Text scanning of result panels with tight patterns
 *   3. Score indicator showing full marks
 *   4. Broad body text scan (guarded to avoid problem-statement false matches)
 *
 * The isHackerRankAcceptedSubmission() function is designed to be called
 * after the result has loaded. The content script adds retry logic on top.
 */

const HR_SUCCESS_PATTERNS = /\b(congratulations|all test cases passed|passed|accepted|great job|well done|solved|score:\s*\d+\.?\d*\s*\/\s*\d+|100%|full score)\b/i;
const HR_FAILURE_PATTERNS = /\b(wrong answer|runtime error|time limit exceeded|compilation error|segmentation fault|memory limit exceeded|terminated due to timeout|presentation error|partially correct)\b/i;

/**
 * Selectors targeting HackerRank's submission result containers.
 * These are prioritised: specific first, generic last.
 */
const HR_RESULT_SELECTORS = [
  // Score/verdict text containers
  '[class*="status-right"]',
  '[class*="result-text"]',
  '[class*="result-message"]',
  '[class*="submission-result"]',
  '[class*="challenge-result"]',
  '[class*="challenge_result"]',
  '[class*="verdict"]',
  '[class*="congratulations"]',
  '[class*="success-message"]',
  '[class*="success_message"]',
  // Notification/toast banners that appear after submission
  '[class*="notify-bar"]',
  '[class*="alert-message"]',
  '[class*="flash-message"]',
  // Test case result boxes
  '[class*="test-case"]',
  '[class*="testcase"]',
  // Popup/modal content
  '[class*="modal-body"]',
  '[class*="popup-body"]',
  '[class*="popup-content"]',
  // ARIA roles
  '[role="alert"]',
  '[role="status"]',
  '[role="dialog"]',
  // Score display
  '[class*="score"]',
  '[class*="points"]',
];

/**
 * CSS class selectors that indicate a passed/accepted state.
 * These match elements HackerRank applies only on success.
 */
const HR_SUCCESS_CLASS_SELECTORS = [
  '[class*="passed"]',
  '[class*="success"]',
  '[class*="accepted"]',
  '[class*="correct"]',
  '[class*="solved"]',
  '[class*="congratulations"]',
  '[class*="check-circle"]',
  '[class*="tick"][class*="green"]',
  // Specific HackerRank class names observed in production
  '.result-state-passed',
  '.status-icon.passed',
  '.submission-icon.passed',
  '.challenge-result-box .passed',
  '.challenge-result-container .passed',
  '[class*="result"][class*="pass"]',
  '[class*="score"][class*="full"]',
];

export function isHackerRankProblemPage(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  if (!/(?:^|\.)hackerrank\.com$/.test(hostname)) {
    return false;
  }

  // Match challenge pages under /challenges/, /contests/, /domains/, /tracks/, /practice/
  return /^\/(challenges|contests|domains|tracks|practice)\/.+/.test(pathname);
}

/** Check for elements that exist only on a successful submission */
function hasSuccessClassElement(): boolean {
  for (const selector of HR_SUCCESS_CLASS_SELECTORS) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        // Make sure the element is visible (not hidden in a collapsed section)
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          return true;
        }
      }
    } catch {
      // Selector may be invalid in some browsers
    }
  }
  return false;
}

/** Scan result-specific DOM elements for verdict text */
function readResultElementText(): string {
  for (const selector of HR_RESULT_SELECTORS) {
    try {
      for (const element of document.querySelectorAll(selector)) {
        const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (!text || text.length > 800) {
          continue;
        }

        if (HR_SUCCESS_PATTERNS.test(text) || HR_FAILURE_PATTERNS.test(text)) {
          return text;
        }
      }
    } catch {
      // Continue to next selector
    }
  }
  return '';
}

/**
 * Broad body text scan — used as a last resort.
 * Guarded: we only check if there are result-indicating elements present first,
 * to avoid false matches from problem description text.
 */
function hasSuccessInBodyText(): boolean {
  // Only do a body scan if there are submission-related elements visible
  // (indicating the results panel has loaded)
  const hasResultPanel = Boolean(
    document.querySelector(
      '[class*="result"], [class*="submission"], [class*="verdict"], [class*="score"], [class*="testcase"]'
    )
  );
  if (!hasResultPanel) {
    return false;
  }

  // Scan only main content area, not the entire body (avoids problem statement matches)
  const mainContent =
    document.querySelector('main') ||
    document.querySelector('[class*="content"]') ||
    document.querySelector('[class*="main"]') ||
    document.body;

  const bodyText = mainContent?.innerText?.replace(/\s+/g, ' ') ?? '';
  // Require success pattern AND absence of failure patterns
  return HR_SUCCESS_PATTERNS.test(bodyText) && !HR_FAILURE_PATTERNS.test(bodyText);
}

/**
 * Check if HackerRank is showing a score of full marks.
 * e.g. "Score: 10/10" or "100 / 100" or "100%"
 */
function hasFullScoreIndicator(): boolean {
  const scoreElements = document.querySelectorAll(
    '[class*="score"], [class*="points"], [class*="result-state"]'
  );

  for (const el of scoreElements) {
    const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    // Match patterns like "10/10", "100/100", "100 / 100"
    if (/\b(\d+(\.\d+)?)\s*\/\s*\1\b/.test(text)) {
      return true;
    }
    // Match 100% pattern
    if (/\b100\s*%/.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Main acceptance check. Called synchronously when user presses Sync.
 * The content script adds retry logic on top of this function for HackerRank.
 */
function checkHackerRankAccepted(): boolean {
  // 1. Explicit success CSS class — most reliable (HackerRank applies these only on pass)
  if (hasSuccessClassElement()) {
    return true;
  }

  // 2. Result element text scan
  const resultText = readResultElementText();
  if (resultText) {
    return HR_SUCCESS_PATTERNS.test(resultText) && !HR_FAILURE_PATTERNS.test(resultText);
  }

  // 3. Full score indicator (10/10, 100/100, 100%)
  if (hasFullScoreIndicator()) {
    return true;
  }

  // 4. Broad body text scan (last resort, guarded)
  if (hasSuccessInBodyText()) {
    return true;
  }

  return false;
}

function hasFailureElementOrText(): boolean {
  const resultText = readResultElementText();
  if (resultText && HR_FAILURE_PATTERNS.test(resultText)) {
    return true;
  }
  
  const hasResultPanel = Boolean(
    document.querySelector(
      '[class*="result"], [class*="submission"], [class*="verdict"], [class*="score"], [class*="testcase"]'
    )
  );
  if (!hasResultPanel) return false;
  
  const mainContent =
    document.querySelector('main') ||
    document.querySelector('[class*="content"]') ||
    document.querySelector('[class*="main"]') ||
    document.body;

  const bodyText = mainContent?.innerText?.replace(/\s+/g, ' ') ?? '';
  return HR_FAILURE_PATTERNS.test(bodyText) && !HR_SUCCESS_PATTERNS.test(bodyText);
}

export async function isHackerRankAcceptedSubmission(): Promise<boolean> {
  if (checkHackerRankAccepted()) return true;
  if (hasFailureElementOrText()) return false;
  
  return new Promise((resolve) => {
    let timeout: number | null = null;
    
    const observer = new MutationObserver(() => {
      if (checkHackerRankAccepted()) {
        cleanup();
        resolve(true);
      } else if (hasFailureElementOrText()) {
        cleanup();
        resolve(false);
      }
    });

    const cleanup = () => {
      observer.disconnect();
      if (timeout) window.clearTimeout(timeout);
    };

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    
    // Wait up to 15 seconds for a result
    timeout = window.setTimeout(() => {
      cleanup();
      resolve(checkHackerRankAccepted());
    }, 15000);
  });
}
