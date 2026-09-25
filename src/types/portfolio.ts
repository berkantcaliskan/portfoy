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

export type PropertyStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD'

export interface PortfolioItem {
  id: string
  title: string
  projectCode: string
  type: PropertyType
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
}
