// Runs before all stores to ensure a 100% clean, zero-data state when the project is loaded.
const CLEAN_SLATE_VERSION_KEY = 'demirturk_clean_slate_v5'

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (localStorage.getItem(CLEAN_SLATE_VERSION_KEY) !== 'true') {
      const preserveKeys = new Set([
        'demirturk_users_v2',
        'demirturk_active_user_v2',
        'demirturk_logged_out',
        'demirturk_ui_settings_v1',
        'demirturk_dock_pinned_apps_v3',
        'demirturk_theme_accent',
        'demirturk_theme_contrast',
        'demirturk_font_size',
        'demirturk_dock_enabled',
        'demirturk_start_menu_grid',
        CLEAN_SLATE_VERSION_KEY,
      ])

      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !preserveKeys.has(key)) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach((k) => localStorage.removeItem(k))
      localStorage.setItem(CLEAN_SLATE_VERSION_KEY, 'true')
    }
  }
} catch {
  // ignore storage errors
}

