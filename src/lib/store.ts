import { useSyncExternalStore } from 'react'

/** Tiny observable store, shared by settings, usage, location and ride state. */
export interface Store<T> {
  get: () => T
  set: (next: T) => void
  update: (fn: (prev: T) => T) => void
  subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  const set = (next: T) => {
    if (Object.is(next, state)) return
    state = next
    listeners.forEach((l) => l())
  }
  return {
    get: () => state,
    set,
    update: (fn) => set(fn(state)),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/** localStorage helpers that never throw (private mode, quota, disabled storage). */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: keep working in memory */
  }
}
