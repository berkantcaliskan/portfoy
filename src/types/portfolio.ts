export type PropertyType =
  | '1+1'
  | '2+1'
  | '3+1'
  | '4+1'
  | 'Villa'
  | 'Dubleks'
  | 'Penthouse'
  | 'Ticari'
  | 'Arsa'
  | 'Diğer'

export type PropertyStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD'

export interface PortfolioItem {
  id: string
  title: string
  projectCode: string
  type: PropertyType
  typeDescription?: string
  hasPool?: boolean
  rowColor?: string
  location: string
  price: number
  currency: 'TRY' | 'USD' | 'EUR'
  netM2: number
  grossM2: number
  floor?: string
  features: string[]
  imageUrl: string
  description: string
  status: PropertyStatus
  createdAt: string
  entryKind?: 'EXTERNAL'
  installmentPrice?: number
  installmentTerms?: string
  consultant?: string
  loan?: string
  createdByUserId?: string
}
