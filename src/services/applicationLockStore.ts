export const LOCK_DELAYS = [
  { value: 0, label: 'Hemen' },
  { value: 60_000, label: '1 dakika sonra' },
  { value: 900_000, label: '15 dakika sonra' },
  { value: 1_800_000, label: '30 dakika sonra' },
] as const

interface LockConfiguration {
  version: 1
  salt: string
  hash: string
  length: number
  delay: number
}
interface LockState {
  account: string | null
  configured: boolean
  locked: boolean
  length: number
  delay: number
}
const keyFor = (account: string) => 'demirturk_app_lock_v1_' + account
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
async function pinHash(pin: string, salt: string): Promise<string> {
  const saltBytes = Uint8Array.from(salt.match(/.{2}/g) || [], byte => parseInt(byte, 16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 210_000 }, key, 256)
  return hex(new Uint8Array(result))
}

class ApplicationLockStore {
  private configuration: LockConfiguration | null = null
  private state: LockState = { account: null, configured: false, locked: false, length: 4, delay: 0 }
  private listeners = new Set<() => void>()
  private deadline: number | null = null
  private timer: number | undefined
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(value: Partial<LockState>) {
    this.state = { ...this.state, ...value }
    this.listeners.forEach(listener => listener())
  }
  private cancelTimer() { window.clearTimeout(this.timer); this.deadline = null }
  lock = () => {
    if (!this.configuration || this.state.locked) return
    this.cancelTimer()
    this.update({ locked: true })
  }
  start(account: string | null) {
    this.cancelTimer()
    this.configuration = null
    if (account) {
      try {
        const value = JSON.parse(localStorage.getItem(keyFor(account)) || 'null')
        if (value?.version === 1 && /^[0-9a-f]{32}$/.test(value.salt) && /^[0-9a-f]{64}$/.test(value.hash)
          && Number.isInteger(value.length) && value.length >= 4 && value.length <= 8
          && LOCK_DELAYS.some(delay => delay.value === value.delay)) this.configuration = value
      } catch { /* A lock is enabled only after a complete saved setup. */ }
    }
    this.update({
      account, configured: Boolean(this.configuration), locked: Boolean(this.configuration),
      length: this.configuration?.length || 4, delay: this.configuration?.delay || 0,
    })
    const leave = () => {
      if (!this.configuration || this.state.locked || this.deadline !== null) return
      if (this.configuration.delay === 0) { this.lock(); return }
      this.deadline = Date.now() + this.configuration.delay
      this.timer = window.setTimeout(this.lock, this.configuration.delay)
    }
    const returnToApp = () => {
      if (this.deadline !== null && Date.now() >= this.deadline) this.lock()
      this.cancelTimer()
    }
    const visibility = () => { if (document.visibilityState === 'hidden') leave(); else returnToApp() }
    const storage = (event: StorageEvent) => { if (account && event.key === keyFor(account)) this.lock() }
    window.addEventListener('blur', leave)
    window.addEventListener('focus', returnToApp)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('storage', storage)
    return () => {
      this.cancelTimer()
      window.removeEventListener('blur', leave)
      window.removeEventListener('focus', returnToApp)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('storage', storage)
    }
  }
  async configure(pin: string, delay: number) {
    const account = this.state.account
    if (!account || !/^\d{4,8}$/.test(pin) || !LOCK_DELAYS.some(item => item.value === delay)) throw Error('4–8 rakamlı bir parola belirleyin.')
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
    const configuration: LockConfiguration = { version: 1, salt, hash: await pinHash(pin, salt), length: pin.length, delay }
    if (this.state.account !== account) throw Error('Hesap değişti. Ayarı yeniden açın.')
    localStorage.setItem(keyFor(account), JSON.stringify(configuration))
    this.configuration = configuration
    this.cancelTimer()
    this.update({ configured: true, length: pin.length, delay, locked: false })
  }
  setDelay(delay: number) {
    if (!this.configuration || !this.state.account || !LOCK_DELAYS.some(item => item.value === delay)) return
    const configuration = { ...this.configuration, delay }
    localStorage.setItem(keyFor(this.state.account), JSON.stringify(configuration))
    this.configuration = configuration
    this.update({ delay })
  }
  private async verify(pin: string) {
    const configuration = this.configuration
    if (!configuration || pin.length !== configuration.length) return false
    const actual = await pinHash(pin, configuration.salt)
    let difference = 0
    for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ configuration.hash.charCodeAt(index)
    return configuration === this.configuration && difference === 0
  }
  async unlock(pin: string): Promise<boolean> {
    if (!await this.verify(pin)) return false
    this.cancelTimer()
    this.update({ locked: false })
    return true
  }
  async disable(pin: string): Promise<boolean> {
    if (!await this.verify(pin) || !this.state.account) return false
    localStorage.removeItem(keyFor(this.state.account))
    this.configuration = null
    this.cancelTimer()
    this.update({ configured: false, locked: false })
    return true
  }
}
export const applicationLockStore = new ApplicationLockStore()
