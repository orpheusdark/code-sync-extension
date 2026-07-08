export function buildCommitMessage(title: string, problemId: string): string {
  return `Solved #${problemId} ${title}`;
}
