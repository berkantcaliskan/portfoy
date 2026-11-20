import { forwardRef } from 'react'
import { formatLira, groupNotePages, liraInWords, type NoteInstallment } from '@/utils/promissoryNotes'
import documentStyles from './PromissoryNoteDocument.css?inline'

export interface NoteDocumentDetails {
  creditor: string
  issuerName: string
  signerName: string
  issuerId: string
  address: string
  issuedOn: string
  issuePlace: string
  nonNegotiable: boolean
  consideration: '' | 'Malen' | 'Nakden'
  accelerationText: string
}

const longDate = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeZone: 'UTC' })
const shortDate = (value: string) => value.split('-').reverse().join('.')

export const PromissoryNoteDocument = forwardRef<HTMLDivElement, {
  details: NoteDocumentDetails
  notes: (NoteInstallment & { cents: number })[]
  activePage: number
}>(function PromissoryNoteDocument({ details, notes, activePage }, ref) {
  const pages = groupNotePages(notes)
  return (
    <>
      <style>{documentStyles}</style>
      <div className="note-document" ref={ref}>
        {pages.map((page, index) => (
          <section key={page[0].number} className="note-page" hidden={index !== activePage} aria-label={`Senet sayfası ${index + 1}`}>
            {page.map(note => (
              <article className="note-slip" key={note.number} aria-label={`Senet ${note.number}/${notes.length}`}>
                <dl className="note-head">
                  <div><dt>Keşide Tarihi</dt><dd>{shortDate(details.issuedOn)}</dd></div>
                  <div><dt>Keşide Yeri</dt><dd>{details.issuePlace}</dd></div>
                  <div><dt>Ödeme Tarihi</dt><dd>{shortDate(note.dueDate)}</dd></div>
                  <div><dt>Türk Lirası</dt><dd>#{formatLira(note.cents)}#</dd></div>
                  <div><dt>Senet No.</dt><dd>{note.number}/{notes.length}</dd></div>
                </dl>
                <p className="note-promise">
                  İşbu bono ile <strong>{longDate.format(new Date(note.dueDate + 'T00:00:00Z'))}</strong> tarihinde,
                  <strong> #{liraInWords(note.cents)}# </strong> tutarını
                  lehdar <strong>{details.creditor}</strong> adlı kişi veya kuruluşa{details.nonNegotiable ? '' : ' ya da emrine'} kayıtsız ve şartsız ödemeyi taahhüt ederim.
                </p>
                {details.consideration && <p className="note-clause">Bedeli {details.consideration.toLocaleLowerCase('tr-TR')} alınmıştır.</p>}
                {details.nonNegotiable && <p className="note-clause"><strong>Emre yazılı değildir. Ciro edilemez.</strong></p>}
                <div className="note-foot">
                  <dl className="note-details">
                    <div><dt>Borçlu</dt><dd>{details.issuerName}</dd></div>
                    <div><dt>T.C. / Vergi No</dt><dd>{details.issuerId}</dd></div>
                    <div><dt>Adres</dt><dd>{details.address.replace(/\s+/g, ' ')}</dd></div>
                    {details.signerName && <div><dt>Yetkili / Temsilci</dt><dd>{details.signerName}</dd></div>}
                  </dl>
                  <p className="note-signature">{details.signerName ? 'Yetkili / temsilci imzası' : 'Borçlu imzası'}</p>
                </div>
              </article>
            ))}
          </section>
        ))}
        {details.accelerationText && (
          <section className="note-page note-annex" hidden={activePage !== pages.length} aria-label="Muacceliyet için ayrı protokol">
            <h2>Muacceliyet için ayrı protokol</h2>
            <p><strong>Alacaklı</strong> {details.creditor}</p>
            <p><strong>Borçlu</strong> {details.issuerName}</p>
            <p><strong>Keşide tarihi ve yeri</strong> {shortDate(details.issuedOn)} · {details.issuePlace}</p>
            <p><strong>İlgili senetler</strong> 1/{notes.length}–{notes.length}/{notes.length} · Toplam {formatLira(notes.reduce((sum, note) => sum + note.cents, 0))} TL</p>
            <p className="note-annex-text">{details.accelerationText}</p>
            <div className="note-annex-signatures">
              <p className="note-signature">Alacaklı imzası</p>
              <p className="note-signature">Borçlu / yetkili imzası</p>
            </div>
          </section>
        )}
      </div>
    </>
  )
})
