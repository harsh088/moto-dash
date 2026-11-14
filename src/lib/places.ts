import { createStore, loadJSON, saveJSON, useStore } from './store'

export interface Place {
  name: string
  address: string
  lat: number
  lon: number
}

export type FavouriteKind = 'home' | 'work' | 'custom'

export interface Favourite {
  id: string
  kind: FavouriteKind
  label: string
  place: Place
}

const FAV_KEY = 'motodash.favourites.v1'
const RECENT_KEY = 'motodash.recents.v1'
const MAX_RECENTS = 10

const favStore = createStore<Favourite[]>(loadJSON<Favourite[]>(FAV_KEY, []))
const recentStore = createStore<Place[]>(loadJSON<Place[]>(RECENT_KEY, []))

const samePlace = (a: Place, b: Place) =>
  Math.abs(a.lat - b.lat) < 0.0002 && Math.abs(a.lon - b.lon) < 0.0002

export function saveFavourite(kind: FavouriteKind, place: Place, label?: string): void {
  favStore.update((list) => {
    // Home and Work are single slots; custom ones are de-duplicated by location.
    const rest = list.filter((f) => (kind === 'custom' ? !(f.kind === 'custom' && samePlace(f.place, place)) : f.kind !== kind))
    const fav: Favourite = {
      id: kind === 'custom' ? `c-${Date.now()}` : kind,
      kind,
      label: label ?? (kind === 'home' ? 'Home' : kind === 'work' ? 'Work' : place.name),
      place,
    }
    return [...rest, fav]
  })
  saveJSON(FAV_KEY, favStore.get())
}

export function removeFavourite(id: string): void {
  favStore.update((list) => list.filter((f) => f.id !== id))
  saveJSON(FAV_KEY, favStore.get())
}

export function addRecent(place: Place): void {
  recentStore.update((list) => [place, ...list.filter((p) => !samePlace(p, place))].slice(0, MAX_RECENTS))
  saveJSON(RECENT_KEY, recentStore.get())
}

export function clearRecents(): void {
  recentStore.set([])
  saveJSON(RECENT_KEY, [])
}

export const useFavourites = (): Favourite[] => useStore(favStore)
export const useRecents = (): Place[] => useStore(recentStore)
