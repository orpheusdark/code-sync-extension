/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
export async function showNotification(message: string): Promise<void> {
  try {
    await chrome.notifications.create(undefined, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'CodeSync',
      message
    });
  } catch {
    // Ignore notification errors in non-supported environments.
  }
}
