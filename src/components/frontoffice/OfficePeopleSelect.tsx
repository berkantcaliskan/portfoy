import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import type { OfficeContext } from '@/types/frontOffice'
import { sortOfficePeople } from '@/types/frontOffice'
import { userStore } from '@/services/userStore'
import { visibleDepartment } from '@/types/teamDirectory'

// Sunucudan gelen kişide kullanıcı adı yok; görünen departman için kullanıcı listesinden bulunur
function shownDepartment(person: { id: string; department?: string }) {
  const user = userStore.getAll().find(u => u.id === person.id)
  return visibleDepartment({ username: user?.username, department: person.department || '' }, userStore.getCurrentUser())
}

export function OfficePeopleSelect({ label, people, firstDepartment, value, onChange, disabled }: {
  label: string
  people: OfficeContext['consultants']
  firstDepartment: string
  value: string[]
  onChange: (value: string[]) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 260, maxHeight: 280 })
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const choices = sortOfficePeople(people, firstDepartment)
  const names = value.map(id => people.find(person => person.id === id)?.name || 'Eski personel').join(', ')

  function positionMenu() {
    if (!trigger.current) return
    const rect = trigger.current.getBoundingClientRect()
    const width = Math.min(300, window.innerWidth - 24)
    const below = window.innerHeight - rect.bottom - 16
    const height = Math.min(280, Math.max(below, rect.top - 16))
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: below >= height ? rect.bottom + 6 : Math.max(12, rect.top - height - 6),
      width, maxHeight: height,
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    positionMenu()
    menu.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    }
    const reposition = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) positionMenu()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  return <>
    <button ref={trigger} type="button" aria-label={label} aria-expanded={open} aria-haspopup="dialog"
      className="office-entry-control office-people-trigger" title={names || '—'} disabled={disabled} onClick={() => setOpen(!open)}>
      <span className="truncate">{names || '—'}</span><ChevronDown size={13} className="shrink-0" />
    </button>
    {open && createPortal(<div ref={menu} role="dialog" aria-label={label}
      className="office-people-menu" style={position} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) setOpen(false)
      }}>
      <button type="button" className="office-people-option" onClick={() => onChange([])}>— Seçimi temizle</button>
      {choices.map(person => <label key={person.id} className="office-people-option">
        <input type="checkbox" checked={value.includes(person.id)} onChange={event => onChange(event.target.checked
          ? [...value, person.id] : value.filter(id => id !== person.id))} />
        <span>{person.department && <span className="opacity-60">{shownDepartment(person)} · </span>}{person.name}</span>
      </label>)}
    </div>, document.body)}
  </>
}
