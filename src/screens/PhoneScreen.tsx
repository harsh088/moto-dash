import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { type Contact, MAX_CONTACTS, saveContacts, telHref, useContacts } from '../lib/contacts'
import { isNative } from '../lib/native'
import { type ContactsAccess, type PhoneContact, loadPhoneContacts } from '../lib/phoneContacts'

type Tab = 'favourites' | 'contacts' | 'keypad'

// ---------- Favourites ----------
function Favourites() {
  const contacts = useContacts()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Contact[]>([])

  const startEdit = () => {
    setDraft(contacts.length ? contacts : [{ id: `${Date.now()}`, name: '', number: '' }])
    setEditing(true)
  }
  const change = (id: string, field: 'name' | 'number', value: string) =>
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  const save = () => {
    saveContacts(draft.filter((c) => c.name.trim() && c.number.trim()).map((c) => ({ ...c, name: c.name.trim(), number: c.number.trim() })))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="card">
        {draft.map((c, i) => (
          <div key={c.id} className="contact-edit">
            <input className="text-input" placeholder={`Name ${i + 1}`} value={c.name} onChange={(e) => change(c.id, 'name', e.target.value)} aria-label={`Contact ${i + 1} name`} />
            <input className="text-input" type="tel" inputMode="tel" placeholder="Phone number" value={c.number} onChange={(e) => change(c.id, 'number', e.target.value)} aria-label={`Contact ${i + 1} number`} />
            <button type="button" className="btn danger-text" onClick={() => setDraft((d) => d.filter((x) => x.id !== c.id))}>
              Remove
            </button>
          </div>
        ))}
        {draft.length < MAX_CONTACTS && (
          <button type="button" className="btn" onClick={() => setDraft((d) => [...d, { id: `${Date.now()}`, name: '', number: '' }])}>
            + Add favourite
          </button>
        )}
        <div className="btn-row">
          <button type="button" className="btn primary grow" onClick={save}>
            Save
          </button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {contacts.length === 0 ? (
        <div className="card">
          <p className="big">No favourites yet.</p>
          <p className="muted">Add up to {MAX_CONTACTS} people{isNative ? ', or tap ☆ next to anyone in Contacts' : ''}.</p>
        </div>
      ) : (
        <div className="contact-grid">
          {contacts.map((c) => (
            <a key={c.id} className="tile contact-tile" href={telHref(c.number)}>
              <span className="avatar">{c.name.slice(0, 1).toUpperCase()}</span>
              <span className="contact-name">{c.name}</span>
              <span className="row-sub">{c.number}</span>
            </a>
          ))}
        </div>
      )}
      <button type="button" className="btn" onClick={startEdit}>
        Edit favourites
      </button>
    </>
  )
}

// ---------- Contacts (iPhone address book) ----------
function Contacts() {
  const favourites = useContacts()
  const [state, setState] = useState<{ access: ContactsAccess | 'loading'; list: PhoneContact[] }>({ access: 'loading', list: [] })
  const [query, setQuery] = useState('')
  useEffect(() => {
    let alive = true
    void loadPhoneContacts().then((r) => alive && setState({ access: r.access, list: r.contacts }))
    return () => {
      alive = false
    }
  }, [])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? state.list.filter((c) => c.name.toLowerCase().includes(q) || c.numbers.some((n) => n.number.replace(/\D/g, '').includes(q))) : state.list
  }, [query, state.list])

  const addFavourite = (name: string, number: string) => {
    if (favourites.length >= MAX_CONTACTS || favourites.some((f) => f.number === number)) return
    saveContacts([...favourites, { id: `${Date.now()}`, name, number }])
  }

  if (state.access === 'unavailable') return <div className="card muted">Contacts are available in the iPhone app.</div>
  if (state.access === 'loading') return <p className="muted big">Loading contacts…</p>
  if (state.access === 'denied')
    return (
      <div className="card">
        <p className="big">Contacts access is off.</p>
        <p className="muted">Turn it on in iPhone Settings → Moto Dash → Contacts.</p>
      </div>
    )
  return (
    <>
      <input className="search-input" type="search" placeholder="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search contacts" />
      <div className="list">
        {shown.map((c) =>
          c.numbers.map((n, i) => {
            const fav = favourites.some((f) => f.number === n.number)
            return (
              <div key={`${c.id}-${i}`} className="list-row-wrap">
                <a className="list-row" href={telHref(n.number)}>
                  <span className="avatar small">{c.name.slice(0, 1).toUpperCase()}</span>
                  <span className="row-main">
                    <span className="row-title">{c.name}</span>
                    <span className="row-sub">
                      {n.label} · {n.number}
                    </span>
                  </span>
                  <Icon name="phone" size={26} />
                </a>
                <button
                  type="button"
                  className={`btn slim${fav ? ' on' : ''}`}
                  onClick={() => addFavourite(c.name, n.number)}
                  disabled={fav || favourites.length >= MAX_CONTACTS}
                  aria-label={fav ? `${c.name} is a favourite` : `Add ${c.name} to favourites`}
                >
                  <Icon name="star" size={24} filled={fav} />
                </button>
              </div>
            )
          }),
        )}
        {shown.length === 0 && <p className="muted pad">No contacts found.</p>}
      </div>
    </>
  )
}

// ---------- Keypad ----------
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

function Keypad() {
  const [num, setNum] = useState('')
  return (
    <div className="keypad-wrap">
      <div className="keypad-display" aria-live="polite">
        {num || <span className="muted">Enter number</span>}
      </div>
      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k} type="button" className="key" onClick={() => setNum((n) => (n + k).slice(0, 20))}>
            {k}
          </button>
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className="btn grow" onClick={() => setNum((n) => n.slice(0, -1))} disabled={!num} aria-label="Delete last digit">
          <Icon name="backspace" size={26} /> Delete
        </button>
        <a className={`btn call grow${num ? '' : ' disabled'}`} href={num ? telHref(num) : undefined} aria-disabled={!num}>
          <Icon name="phone" size={26} /> Call
        </a>
      </div>
    </div>
  )
}

export default function PhoneScreen() {
  const [tab, setTab] = useState<Tab>('favourites')
  const tabs: { id: Tab; label: string; icon: 'star' | 'person' | 'keypad' }[] = [
    { id: 'favourites', label: 'Favourites', icon: 'star' },
    { id: 'contacts', label: 'Contacts', icon: 'person' },
    { id: 'keypad', label: 'Keypad', icon: 'keypad' },
  ]
  return (
    <div className="screen phone-screen">
      <div className="segmented phone-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={22} filled={false} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'favourites' && <Favourites />}
      {tab === 'contacts' && <Contacts />}
      {tab === 'keypad' && <Keypad />}
      <p className="muted small">Calls open on the iPhone call screen. Incoming calls are answered there or with your helmet headset button.</p>
    </div>
  )
}
