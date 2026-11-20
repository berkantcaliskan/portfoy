import { Check, Plus, X } from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import type { OfficeContext, OfficePayload } from '@/types/frontOffice'
import { officePersonIds, VISITOR_SOURCE_OPTIONS, VISITOR_POTENTIAL_OPTIONS } from '@/types/frontOffice'
import { OfficePeopleSelect } from './OfficePeopleSelect'
import './VisitorEntryRow.css'

export function VisitorEntryRow({ value, onChange, context, disabled, editing, onCancel }: {
  value: OfficePayload
  onChange: (key: keyof OfficePayload, value: string | string[]) => void
  context: OfficeContext
  disabled: boolean
  editing: boolean
  onCancel: () => void
}) {
  const field = (name: string, key: keyof OfficePayload, type = 'text', required = false) => <input
    aria-label={name} type={type} value={typeof value[key] === 'string' ? value[key] as string : ''} required={required} disabled={disabled}
    maxLength={key === 'notes' ? 2000 : key === 'phone' ? 100 : 500}
    onChange={event => onChange(key, event.target.value)} className="office-entry-control" />
  return <tr className="office-entry-row" data-potential={value.potential || undefined}>
    <td>{field('Tarih', 'visitedAt', 'date', true)}</td>
    <td>{field('Adı, Soyadı', 'name', 'text', true)}</td>
    <td>{field('Telefon', 'phone', 'tel', true)}</td>
    <td><OfficePeopleSelect label="İlişkili Temsilci" people={context.representatives} firstDepartment="Müşteri İlişkileri"
      value={officePersonIds(value, 'representative')} disabled={disabled}
      onChange={ids => onChange('representativeIds', ids)} /></td>
    <td><CustomSelect title="Kanal" value={value.source || ''} disabled={disabled} className="office-entry-control"
      onChange={event => onChange('source', event.target.value)}><option value="">—</option>
      {VISITOR_SOURCE_OPTIONS.map(source => <option key={source} value={source}>{source}</option>)}
    </CustomSelect></td>
    <td><OfficePeopleSelect label="Satış Danışmanı" people={context.consultants} firstDepartment="Satış"
      value={officePersonIds(value, 'staff')} disabled={disabled}
      onChange={ids => onChange('staffIds', ids)} /></td>
    <td>
      <div className="office-entry-notes">
        {field('Açıklama', 'notes')}
        {context.visitorPotentialColors && <div role="group" aria-label="Müşteri potansiyeli" className="office-potential-options">
          {VISITOR_POTENTIAL_OPTIONS.map(option => {
            const selected = value.potential === option.value
            return <button
              key={option.value}
              type="button"
              className="office-potential-option"
              data-potential={option.value}
              aria-label={option.label}
              aria-pressed={selected}
              title={option.label}
              disabled={disabled}
              onClick={() => onChange('potential', selected ? '' : option.value)}
            >{selected && <Check size={13} aria-hidden="true" />}</button>
          })}
        </div>}
      </div>
    </td>
    <td><div className="office-row-actions">
      {editing && <button type="button" disabled={disabled} onClick={onCancel} className="office-entry-cancel" aria-label="Düzenlemeyi iptal et"><X size={15} /></button>}
      <button type="submit" disabled={disabled} className="office-entry-add" aria-label={editing ? 'Müşteri değişikliklerini kaydet' : 'Müşteri ekle'} title={editing ? 'Değişiklikleri kaydet' : 'Müşteri ekle'}>{editing ? <Check size={19} /> : <Plus size={19} />}</button>
    </div></td>
  </tr>
}
