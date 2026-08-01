export const EXPLORER_ENHANCEMENTS_STORAGE_KEY =
  "explorerEnhancementsEnabled";

export const DEFAULT_EXPLORER_ENHANCEMENTS_ENABLED = true;

export function resolveExplorerEnhancementsEnabled(value: unknown): boolean {
  return value !== false;
}

export async function getExplorerEnhancementsEnabled(): Promise<boolean> {
  const stored = await chrome.storage.sync.get(
    EXPLORER_ENHANCEMENTS_STORAGE_KEY,
  );
  return resolveExplorerEnhancementsEnabled(
    stored[EXPLORER_ENHANCEMENTS_STORAGE_KEY],
  );
}

export async function setExplorerEnhancementsEnabled(
  enabled: boolean,
): Promise<void> {
  await chrome.storage.sync.set({
    [EXPLORER_ENHANCEMENTS_STORAGE_KEY]: enabled,
  });
}
