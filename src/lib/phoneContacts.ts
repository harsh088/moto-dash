import { isNative } from './native'

/** A contact from the iPhone address book (native app only). */
export interface PhoneContact {
  id: string
  name: string
  numbers: { label: string; number: string }[]
}

export type ContactsAccess = 'granted' | 'denied' | 'unavailable'

/** Reads the iPhone contacts (name + phone numbers only). Asks for permission the first time. */
export async function loadPhoneContacts(): Promise<{ access: ContactsAccess; contacts: PhoneContact[] }> {
  if (!isNative) return { access: 'unavailable', contacts: [] }
  const { Contacts } = await import('@capacitor-community/contacts')
  try {
    let perm = await Contacts.checkPermissions()
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') perm = await Contacts.requestPermissions()
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') return { access: 'denied', contacts: [] }
    const { contacts } = await Contacts.getContacts({ projection: { name: true, phones: true } })
    const list = contacts
      .map((c) => ({
        id: c.contactId,
        name:
          c.name?.display ||
          [c.name?.given, c.name?.family].filter(Boolean).join(' ') ||
          c.phones?.[0]?.number ||
          'Unknown',
        numbers: (c.phones ?? [])
          .filter((p) => p.number)
          .map((p) => ({ label: p.label || p.type || 'phone', number: p.number! })),
      }))
      .filter((c) => c.numbers.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
    return { access: 'granted', contacts: list }
  } catch {
    return { access: 'denied', contacts: [] }
  }
}
