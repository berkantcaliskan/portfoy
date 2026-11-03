/** Her müşteri için yazımları sıralar; tek hata sonraki denemeleri kilitlemez. */
export class MetaStageQueue {
  private tails = new Map<string, Promise<void>>()
  private failures = new Map<string, unknown>()

  enqueue(id: string, operation: () => Promise<void>): Promise<void> {
    const prior = this.tails.get(id) || Promise.resolve()
    const next = prior.catch(() => {}).then(operation)
    this.tails.set(id, next)
    void next.then(() => {
      if (this.tails.get(id) === next) { this.tails.delete(id); this.failures.delete(id) }
    }, error => {
      if (this.tails.get(id) === next) { this.tails.delete(id); this.failures.set(id, error) }
    })
    return next
  }

  async wait(id: string): Promise<void> {
    await this.tails.get(id)
    if (this.failures.has(id)) throw this.failures.get(id)
  }

  reconcile(id: string): void {
    // Devam eden isteğin sonucunu yok saymayın; yalnızca otoriter yeniden okumadan sonra hatayı temizleyin.
    if (this.tails.has(id)) throw new Error('Aşama kaydı sürüyor; bitmeden sunucu kaydıyla değiştirilemez.')
    this.failures.delete(id)
  }
}
