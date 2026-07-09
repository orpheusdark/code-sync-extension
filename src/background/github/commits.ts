/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
export function buildCommitMessage(title: string, problemId: string): string {
  return `Solved #${problemId} ${title}`;
}
