import { createStore, loadJSON, saveJSON, useStore } from './store'

export interface Contact {
  id: string
  name: string
  number: string
}

export const MAX_CONTACTS = 6
const KEY = 'motodash.contacts.v1'
const store = createStore<Contact[]>(loadJSON<Contact[]>(KEY, []))

export function saveContacts(list: Contact[]): void {
  store.set(list.slice(0, MAX_CONTACTS))
  saveJSON(KEY, store.get())
}

export const useContacts = (): Contact[] => useStore(store)

/** Digits and a leading + only, for tel: links. */
export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`
