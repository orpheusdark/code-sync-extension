import { isLeetCodePage } from './leetcode/detector';
import { extractLeetCodeSubmission, extractLeetCodeSubmissionWithFallback } from './leetcode/extractor';

export function detectAndExtractSubmission(): ReturnType<typeof extractLeetCodeSubmission> {
  if (!isLeetCodePage()) return null;
  return extractLeetCodeSubmission();
}

export async function detectAndExtractSubmissionAsync() {
  if (!isLeetCodePage()) return null;
  return extractLeetCodeSubmissionWithFallback();
}
