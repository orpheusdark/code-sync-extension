export async function loadState<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallback;
}

export async function saveState<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
