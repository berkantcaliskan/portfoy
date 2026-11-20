import { Globe, House, Infinity as Meta, MessageCircle, UserRound, Users } from 'lucide-react'

export const manualChannels = ['Sahibinden', 'Hepsiemlak', 'Direkt'] as const
export function LeadChannelIcon({label}:{label:string}) {
  const Icon=label==='Meta'?Meta:label==='WhatsApp'?MessageCircle:label==='Referans'?Users:label==='Direkt'||label==='Doğrudan'?UserRound:label==='Hepsiemlak'?House:Globe
  return <span className="lead-channel-icon" role="img" aria-label={label} title={label}>
    {label==='Sahibinden'?<b aria-hidden="true">s</b>:<Icon size={14} aria-hidden="true"/>}
  </span>
}
