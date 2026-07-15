/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import { STORAGE_KEYS } from '../../shared/constants';
import { loadState, saveState } from '../../shared/storage';
import type { OfflineQueueItem, SubmissionPayload } from '../../shared/types';

export async function addToOfflineQueue(payload: SubmissionPayload, error: string): Promise<void> {
  const queue = await loadState<OfflineQueueItem[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  
  // Check if already in queue based on signature
  const signature = `${payload.platform}::${payload.slug}::${payload.language}`;
  const existingIndex = queue.findIndex(item => 
    `${item.payload.platform}::${item.payload.slug}::${item.payload.language}` === signature
  );

  if (existingIndex >= 0) {
    queue[existingIndex].lastError = error;
    queue[existingIndex].timestamp = new Date().toISOString();
  } else {
    queue.push({
      id: crypto.randomUUID(),
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      lastError: error
    });
  }

  await saveState(STORAGE_KEYS.OFFLINE_QUEUE, queue);
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  return await loadState<OfflineQueueItem[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
}

export async function removeFromOfflineQueue(id: string): Promise<void> {
  const queue = await loadState<OfflineQueueItem[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  const newQueue = queue.filter(item => item.id !== id);
  await saveState(STORAGE_KEYS.OFFLINE_QUEUE, newQueue);
}

export async function incrementRetryCount(id: string, error: string): Promise<void> {
  const queue = await loadState<OfflineQueueItem[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  const newQueue = queue.map(item => {
    if (item.id === id) {
      return { ...item, retryCount: item.retryCount + 1, lastError: error };
    }
    return item;
  });
  await saveState(STORAGE_KEYS.OFFLINE_QUEUE, newQueue);
}
