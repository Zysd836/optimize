export interface DataItem {
  id: number
  timestamp: number
  value: number
  status: 'active' | 'pending' | 'completed'
}

export type DataItemStatus = DataItem['status']

