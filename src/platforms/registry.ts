/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import type { PlatformAdapter } from './types';
import { isLeetCodeProblemPage } from './leetcode/detector';
import { extractLeetCodeSubmissionWithFallback } from './leetcode/extractor';
import { isGfgAcceptedSubmission, isGfgProblemPage } from './gfg/detector';
import { extractGfgSubmission } from './gfg/extractor';
import { isHackerRankProblemPage, isHackerRankAcceptedSubmission } from './hackerrank/detector';
import { extractHackerRankSubmission } from './hackerrank/extractor';
import { isCodingNinjasProblemPage, isCodingNinjasAcceptedSubmission } from './codingninjas/detector';
import { extractCodingNinjasSubmission } from './codingninjas/extractor';

export { detectPlatformFromHref, detectPlatformFromUrl } from './detect-url';

const ADAPTERS: PlatformAdapter[] = [
  {
    platform: 'leetcode',
    detect: isLeetCodeProblemPage,
    extractSubmission: extractLeetCodeSubmissionWithFallback,
    injectSyncButton: () => undefined,
    isSubmissionAccepted: () => /\baccepted\b/i.test(document.body?.innerText ?? '')
  },
  {
    platform: 'gfg',
    detect: isGfgProblemPage,
    extractSubmission: async () => extractGfgSubmission(),
    injectSyncButton: () => undefined,
    isSubmissionAccepted: isGfgAcceptedSubmission
  },
  {
    platform: 'hackerrank',
    detect: isHackerRankProblemPage,
    extractSubmission: async () => extractHackerRankSubmission(),
    injectSyncButton: () => undefined,
    isSubmissionAccepted: isHackerRankAcceptedSubmission
  },
  {
    platform: 'codingninjas',
    detect: isCodingNinjasProblemPage,
    extractSubmission: async () => extractCodingNinjasSubmission(),
    injectSyncButton: () => undefined,
    isSubmissionAccepted: isCodingNinjasAcceptedSubmission
  }
];

export function getPlatformAdapters(): PlatformAdapter[] {
  return ADAPTERS;
}

export function detectActivePlatform(): PlatformAdapter | null {
  return ADAPTERS.find((adapter) => adapter.detect()) ?? null;
}
