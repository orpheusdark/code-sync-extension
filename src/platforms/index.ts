/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import { detectActivePlatform } from './registry';

export function detectAndExtractSubmission() {
  const adapter = detectActivePlatform();
  return adapter ? adapter.extractSubmission() : null;
}

export async function detectAndExtractSubmissionAsync() {
  const adapter = detectActivePlatform();
  return adapter ? adapter.extractSubmission() : null;
}
