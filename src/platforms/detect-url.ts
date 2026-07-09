/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import type { PlatformId } from './types';

export function detectPlatformFromUrl(hostname: string, pathname: string): PlatformId | null {
  const host = hostname.toLowerCase();
  const path = pathname.toLowerCase();

  if (/(^|\.)leetcode\.com$/.test(host) && /^\/problems\/[^/]+(?:\/|$)/.test(path)) {
    return 'leetcode';
  }

  if (/^(www\.|practice\.)?geeksforgeeks\.org$/.test(host) && /^\/problems\/[^/]+/.test(path)) {
    return 'gfg';
  }

  if (/hackerrank\.com$/.test(host) && /^\/(challenges|contests|domains|tracks|practice)\/.+/.test(path)) {
    return 'hackerrank';
  }

  if (/codeforces\.com$/.test(host) && /^\/(problemset|contest)/.test(path)) {
    return 'codeforces';
  }

  if (/atcoder\.jp$/.test(host) && /^\/(contests|tasks)/.test(path)) {
    return 'atcoder';
  }

  if (/codechef\.com$/.test(host) && /^\/(problems|views|submit)/.test(path)) {
    return 'codechef';
  }

  return null;
}

export function detectPlatformFromHref(href: string): PlatformId | null {
  try {
    const url = new URL(href);
    return detectPlatformFromUrl(url.hostname, url.pathname);
  } catch {
    return null;
  }
}
