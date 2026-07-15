/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import { STORAGE_KEYS } from '../../shared/constants';
import { loadState, saveState } from '../../shared/storage';
import type { SyncHistoryItem } from '../../shared/types';

export async function addHistoryItem(item: Omit<SyncHistoryItem, 'id' | 'timestamp'>): Promise<void> {
  const history = await loadState<SyncHistoryItem[]>(STORAGE_KEYS.SYNC_HISTORY, []);
  
  const newItem: SyncHistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };

  const updatedHistory = [newItem, ...history].slice(0, 100); // Keep last 100 items
  await saveState(STORAGE_KEYS.SYNC_HISTORY, updatedHistory);
}

export async function updateHistoryItem(id: string, updates: Partial<SyncHistoryItem>): Promise<void> {
  const history = await loadState<SyncHistoryItem[]>(STORAGE_KEYS.SYNC_HISTORY, []);
  
  const updatedHistory = history.map(item => 
    item.id === id ? { ...item, ...updates } : item
  );

  await saveState(STORAGE_KEYS.SYNC_HISTORY, updatedHistory);
}
