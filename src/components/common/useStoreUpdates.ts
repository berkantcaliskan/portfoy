import { useEffect, useReducer } from 'react'

export function useStoreUpdates(store: { subscribe(listener: () => void): () => void }) {
  const [, refresh] = useReducer((version: number) => version + 1, 0)
  useEffect(() => {
    const unsubscribe = store.subscribe(refresh)
    refresh()
    return unsubscribe
  }, [store])
}
