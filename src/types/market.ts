export type ItemId = string | number

export interface AduriteListing {
  id: ItemId
  name: string
  usdPrice: number
  robloxAssetId?: number
  thumbnailUrl?: string
}

export interface RolimonItemDetail {
  rap: number | null
  value: number | null
  projected: boolean
  name?: string
}

export interface EnrichedItem {
  id: ItemId
  name: string
  rap: number | null
  isProjected: boolean
  usdPrice: number
  sgdMin: number
  sgdMax: number
  thumbnailUrl?: string
}
