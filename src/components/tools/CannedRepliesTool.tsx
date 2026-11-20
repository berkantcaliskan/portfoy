import { useState } from 'react'
import { Check, Copy, Pencil, Plus, Trash2 } from 'lucide-react'

export interface CannedReply { id: string; title: string; text: string }

const iconButton = 'p-1.5 rounded-lg text-[#a69f99] hover:text-white hover:bg-white/10 transition-colors'

function ReplyCard({ reply, onSave, onDelete, startEditing = false }: {
  reply: CannedReply
  onSave: (reply: CannedReply) => void
  onDelete: () => void
  startEditing?: boolean
}) {
  const [editing, setEditing] = useState(startEditing)
  const [title, setTitle] = useState(reply.title)
  const [text, setText] = useState(reply.text)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reply.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* Panoya erişim yoksa sessizce geç */ }
  }

  if (editing) {
    return (
      <div className="p-4 rounded-2xl bg-[#282522] border border-[#b99881]/50 space-y-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Başlık (ör. Fiyat soranlara)"
          maxLength={80}
          className="w-full bg-[#1e1c1a] border border-[#4a443f] rounded-xl px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-[#b99881]"
        />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Yoruma verilecek cevap"
          rows={5}
          autoFocus
          className="w-full bg-[#1e1c1a] border border-[#4a443f] rounded-xl px-3 py-2 text-sm text-white resize-y focus:outline-none focus:border-[#b99881]"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { if (window.confirm('Bu hazır mesaj silinsin mi?')) onDelete() }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />Sil
          </button>
          <button
            type="button"
            onClick={() => {
              if (!reply.text.trim() && !reply.title.trim()) { onDelete(); return }
              setTitle(reply.title); setText(reply.text); setEditing(false)
            }}
            className="ml-auto px-3 py-1 rounded-full text-xs text-[#a69f99] hover:text-white"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => { onSave({ ...reply, title: title.trim(), text: text.trim() }); setEditing(false) }}
            className="px-3.5 py-1 rounded-full bg-[#b99881] text-[#1c1a18] text-xs font-bold disabled:opacity-40"
          >
            Kaydet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-2xl bg-[#282522] border border-[#4a443f] flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0 text-sm font-bold text-white break-words">{reply.title || 'Hazır mesaj'}</span>
        <button type="button" onClick={() => setEditing(true)} className={iconButton} title="Düzenle" aria-label="Düzenle">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => void copy()} className={iconButton} title="Kopyala" aria-label="Kopyala">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-xs text-[#d6beae] whitespace-pre-wrap break-words leading-relaxed">{reply.text}</p>
    </div>
  )
}

export function CannedRepliesTool({ replies, onChange }: { replies: CannedReply[]; onChange: (replies: CannedReply[]) => void }) {
  const [newId, setNewId] = useState<string | null>(null)
  const list = Array.isArray(replies) ? replies : []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-xs text-[#a69f99]">Sosyal medya yorumlarına verilecek hazır cevaplar. Kopyala ile panoya alıp yapıştırın.</p>
        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID()
            setNewId(id)
            onChange([{ id, title: '', text: '' }, ...list])
          }}
          className="ml-auto shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#b99881] text-[#1c1a18] text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" />Yeni mesaj
        </button>
      </div>
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#a69f99]">Henüz hazır mesaj yok. "Yeni mesaj" ile ekleyin.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map(reply => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              startEditing={reply.id === newId}
              onSave={saved => onChange(list.map(r => r.id === saved.id ? saved : r))}
              onDelete={() => onChange(list.filter(r => r.id !== reply.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
