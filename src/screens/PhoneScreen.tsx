import { useState } from 'react'
import Icon from '../components/Icon'
import { type Contact, MAX_CONTACTS, saveContacts, telHref, useContacts } from '../lib/contacts'

export default function PhoneScreen() {
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

  return (
    <div className="screen">
      <div className="title-row">
        <h1 className="screen-title">
          <Icon name="phone" size={32} /> Phone
        </h1>
        {!editing && (
          <button type="button" className="btn" onClick={startEdit}>
            Edit contacts
          </button>
        )}
      </div>

      {editing ? (
        <div className="card">
          {draft.map((c, i) => (
            <div key={c.id} className="contact-edit">
              <input
                className="text-input"
                placeholder={`Name ${i + 1}`}
                value={c.name}
                onChange={(e) => change(c.id, 'name', e.target.value)}
                aria-label={`Contact ${i + 1} name`}
              />
              <input
                className="text-input"
                type="tel"
                inputMode="tel"
                placeholder="Phone number"
                value={c.number}
                onChange={(e) => change(c.id, 'number', e.target.value)}
                aria-label={`Contact ${i + 1} number`}
              />
              <button type="button" className="btn danger-text" onClick={() => setDraft((d) => d.filter((x) => x.id !== c.id))}>
                Remove
              </button>
            </div>
          ))}
          {draft.length < MAX_CONTACTS && (
            <button
              type="button"
              className="btn"
              onClick={() => setDraft((d) => [...d, { id: `${Date.now()}`, name: '', number: '' }])}
            >
              + Add contact
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
      ) : contacts.length === 0 ? (
        <div className="card">
          <p className="big">No favourite contacts yet.</p>
          <p className="muted">Add up to {MAX_CONTACTS} people you call while riding.</p>
        </div>
      ) : (
        <div className="contact-grid">
          {contacts.map((c) => (
            <a key={c.id} className="tile contact-tile" href={telHref(c.number)}>
              <Icon name="phone" size={36} />
              <span className="contact-name">{c.name}</span>
              <span className="row-sub">{c.number}</span>
            </a>
          ))}
        </div>
      )}
      <p className="muted small">Tapping a contact opens the iPhone call screen. Calls stay in the phone app.</p>
    </div>
  )
}
