/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
export function isLeetCodeProblemPage(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  if (!/(^|\.)leetcode\.com$/.test(hostname)) {
    return false;
  }

  return /^\/problems\/[^/]+/.test(pathname);
}

export function isLeetCodeAcceptedSubmission(): boolean {
  const bodyText = document.body?.innerText ?? '';
  return /\baccepted\b/i.test(bodyText);
}
