export function isLeetCodePage(): boolean {
  return /leetcode\.com/.test(window.location.hostname);
}
