export type Direction = 'income' | 'expense'
export type ExecutionType = 'automatic' | 'requires_approval'
export type TaskStatus = 'open' | 'done'
export type TaskSource = 'manual' | 'recurring_item' | 'renewal'
export type DocumentType = 'purchase_contract' | 'property_photos' | 'rental_contract' | 'insurance_policy' | 'receipt' | 'invoice' | 'other'
export type PaymentMethod = 'bit' | 'cash' | 'check' | 'bank_transfer' | 'standing_order'

export interface Owner {
  id: string
  name: string
}

export interface Property {
  id: string
  owner_id: string
  address: string
  notes: string | null
  created_at: string
}

export interface Contract {
  id: string
  owner_id: string
  property_id: string
  company_name: string
  contact_name: string | null
  contact_phone: string | null
  start_date: string
  end_date: string
  monthly_rent: number
  deposit: number | null
  renewal_alert_days: number[]
  created_at: string
}

export interface RecurringItem {
  id: string
  owner_id: string
  contract_id: string | null
  direction: Direction
  amount: number
  category: string
  day_of_month: number
  start_date: string
  end_date: string | null
  payee: string | null
  execution_type: ExecutionType
  payment_method: string | null
  renewal_alert_days: number[]
  created_at: string
}

export interface Transaction {
  id: string
  owner_id: string
  contract_id: string | null
  recurring_item_id: string | null
  document_id: string | null
  direction: Direction
  amount: number
  date: string
  category: string
  description: string | null
  payment_method: string | null
  created_at: string
}

export interface Task {
  id: string
  owner_id: string
  property_id: string | null
  recurring_item_id: string | null
  transaction_id: string | null
  title: string
  due_date: string | null
  category: string
  status: TaskStatus
  source: TaskSource
  is_recurring: boolean
  recurrence_days: number | null
  created_at: string
}

export interface Document {
  id: string
  owner_id: string
  property_id: string | null
  contract_id: string | null
  transaction_id: string | null
  type: DocumentType
  name: string
  storage_path: string
  date: string | null
  created_at: string
}
