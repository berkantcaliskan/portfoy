export const CRM_AUTH_STORAGE_KEY = 'demirturk-crm-backend-preview-auth'
const preferenceKey = 'demirturk-crm-remember-session'
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Only the main CRM session is moved; Meta's separate storage is untouched. */
export function createCrmSessionStorage(persistent: Store, temporary: Store) {
  const remembered = () => persistent.getItem(preferenceKey) === 'true'
  const active = () => remembered() ? persistent : temporary
  return {
    remembered,
    setRemembered(value: boolean) {
      const previous = active()
      const next = value ? persistent : temporary
      const session = previous.getItem(CRM_AUTH_STORAGE_KEY)
      // Write the destination first so a failed storage write cannot lose the session.
      if (session !== null) next.setItem(CRM_AUTH_STORAGE_KEY, session)
      persistent.setItem(preferenceKey, String(value))
      if (previous !== next) previous.removeItem(CRM_AUTH_STORAGE_KEY)
    },
    getItem(key: string) { return active().getItem(key) },
    setItem(key: string, value: string) { active().setItem(key, value) },
    removeItem(key: string) { persistent.removeItem(key); temporary.removeItem(key) },
  }
}

export const crmSessionStorage = () => createCrmSessionStorage(localStorage, sessionStorage)
