export function parseLeetCodeProblemId(pathname: string): string {
  const match = pathname.match(/problems\/([^/]+)/);
  return match?.[1] ?? 'unknown';
}
