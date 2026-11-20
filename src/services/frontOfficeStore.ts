import { userStore } from './userStore'
import { createFrontOfficeRepository } from './frontOfficeRepository'
import type { OfficeContext } from '../types/frontOffice'

interface State extends OfficeContext { active: boolean; loading: boolean; error: string }
class FrontOfficeStore {
  private state: State = { canAccess: false, isAdmin: false, assignments: [], consultants: [], representatives: [], active: false, loading: false, error: '' }
  private listeners = new Set<() => void>()
  private account = ''
  private generation = 0
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(value: Partial<State>) { this.state = { ...this.state, ...value }; this.listeners.forEach(fn => fn()) }
  start() {
    const sync = () => {
      const user = userStore.getCurrentUser()
      const key = user ? `${user.id}:${user.role}:${Boolean(user.mustChangePassword)}` : ''
      if (key === this.account) return
      this.account = key
      this.generation++
      this.update({ canAccess: user?.role === 'ADMIN' && !user.mustChangePassword, isAdmin: user?.role === 'ADMIN', assignments: [], consultants: [], representatives: [], active: false, error: '' })
      if (user && !user.mustChangePassword) void this.refresh()
    }
    sync()
    const unsubscribe = userStore.subscribe(sync)
    const refresh = () => { if (userStore.getCurrentUser() && !userStore.getCurrentUser()?.mustChangePassword) void this.refresh() }
    window.addEventListener('focus', refresh)
    return () => { unsubscribe(); window.removeEventListener('focus', refresh); this.generation++ }
  }
  repository() {
    const client = userStore.getServerClient()
    if (!client) throw Error('Ön Ofis için sunucu oturumu gerekli.')
    return createFrontOfficeRepository(client)
  }
  async refresh() {
    const generation = ++this.generation
    this.update({ loading: true })
    try {
      const context = await this.repository().context()
      if (generation !== this.generation) return
      this.update({ ...context, loading: false, error: '', active: context.canAccess && (this.state.active || userStore.getCurrentUser()?.department === 'Ön Ofis') })
    } catch (e) {
      if (generation !== this.generation) return
      this.update({ canAccess: userStore.getCurrentUser()?.role === 'ADMIN', assignments: [], consultants: [], representatives: [], loading: false, error: e instanceof Error ? e.message : 'Ön Ofis erişimi doğrulanamadı.' })
    }
  }
  activate(active: boolean) {
    if (active && !this.state.canAccess) return false
    this.update({ active })
    return true
  }
}
export const frontOfficeStore = new FrontOfficeStore()
