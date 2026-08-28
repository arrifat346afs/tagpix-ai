/**
 * Store bootstrap — must be imported BEFORE anything that touches the stores.
 *
 * 1. `enableMapSet()` lets immer draft `Map` instances (used by `fileStore.filePaths`).
 * 2. One-time migration of settings/templates from the legacy redux-persist
 *    localStorage layout (`persist:root`) to the new Zustand persisted stores
 *    (`descify-config`, `descify-template`), so users keep their API keys,
 *    preferences and templates across the migration.
 */
import { enableMapSet } from 'immer';

enableMapSet();

export function migrateLegacyStorage(): void {
  try {
    const raw = localStorage.getItem('persist:root');
    if (!raw) return;

    // redux-persist stores each reducer's slice as a nested JSON string
    const root = JSON.parse(raw) as Record<string, string | undefined>;

    if (root.config && !localStorage.getItem('descify-config')) {
      localStorage.setItem(
        'descify-config',
        JSON.stringify({ state: JSON.parse(root.config), version: 0 })
      );
      console.log('✅ Migrated legacy redux-persist config settings to Zustand store');
    }

    if (root.template && !localStorage.getItem('descify-template')) {
      localStorage.setItem(
        'descify-template',
        JSON.stringify({ state: JSON.parse(root.template), version: 0 })
      );
      console.log('✅ Migrated legacy redux-persist templates to Zustand store');
    }

    localStorage.removeItem('persist:root');
  } catch (error) {
    // Never block startup on migration; defaults will be used instead.
    console.warn('⚠️ Failed to migrate legacy redux-persist storage:', error);
  }
}

migrateLegacyStorage();
