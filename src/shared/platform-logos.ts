/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import type { EnabledPlatformKey } from './types';

export type PlatformLogoKey = EnabledPlatformKey;

/** Maps platform keys to SVG filenames under icons/platforms/. */
export const PLATFORM_LOGO_FILES: Record<PlatformLogoKey, string> = {
  leetcode: 'leetcode.svg',
  gfg: 'geeksforgeeks.svg',
  hackerrank: 'hackerrank.svg',
  codeforces: 'codeforces.svg',
  atcoder: 'atcoder.svg',
  codechef: 'codechef.svg'
};

export interface PlatformCatalogEntry {
  key: PlatformLogoKey;
  label: string;
  desc: string;
}

export const PLATFORM_CATALOG: PlatformCatalogEntry[] = [
  { key: 'leetcode', label: 'LeetCode', desc: 'Competitive programming' },
  { key: 'gfg', label: 'GeeksforGeeks', desc: 'DSA practice platform' },
  { key: 'hackerrank', label: 'HackerRank', desc: 'Skills assessment' },
  { key: 'codeforces', label: 'Codeforces', desc: 'Competitive programming' },
  { key: 'atcoder', label: 'AtCoder', desc: 'Japanese CP platform' },
  { key: 'codechef', label: 'CodeChef', desc: 'Competitive programming' }
];

export function getPlatformLabel(platform: PlatformLogoKey | null | undefined): string {
  if (!platform) {
    return 'None';
  }

  return PLATFORM_CATALOG.find((entry) => entry.key === platform)?.label ?? platform;
}

export function getPlatformLogoPath(platform: PlatformLogoKey): string {
  return `icons/platforms/${PLATFORM_LOGO_FILES[platform]}`;
}

export function getPlatformLogoSvg(platform: PlatformLogoKey, size = 24): string {
  const src = getPlatformLogoPath(platform);
  return `<img class="platform-logo" src="${src}" width="${size}" height="${size}" alt="" style="display:block;border-radius:4px;object-fit:contain;" />`;
}

export function getPlatformCatalogIcon(platform: PlatformLogoKey): string {
  return getPlatformLogoSvg(platform, 28);
}

export const PLATFORM_OPTIONS = PLATFORM_CATALOG.map((entry) => ({
  ...entry,
  icon: getPlatformCatalogIcon(entry.key)
}));
