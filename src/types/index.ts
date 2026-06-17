export type Direction = 'income' | 'expense'
export type ExecutionType = 'automatic' | 'requires_approval'
export type TaskStatus = 'open' | 'done'
export type TaskSource = 'manual' | 'recurring_item' | 'renewal'
export type DocumentType = 'purchase_contract' | 'property_photos' | 'rental_contract' | 'insurance_policy' | 'receipt' | 'invoice' | 'other'
export type PaymentMethod = 'bit' | 'cash' | 'check' | 'bank_transfer' | 'standing_order'

export type UtilityPayer = 'tenant' | 'owner'

export interface Owner {
  id: string
  name: string
  email?: string
}

export interface ContractUtility {
  id: string
  contract_id: string
  utility: string
  payer: UtilityPayer
  amount: number | null
}

export interface Property {
  id: string
  owner_id: string
  address: string
  notes: string | null
  buyer_name: string | null
  block_parcel: string | null
  purchase_price: number | null
  purchase_date: string | null
  key_delivery_date: string | null
  property_size_sqm: number | null
  floor: number | null
  rooms: number | null
  estimated_value: number | null
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
  payment_method: string | null
  requires_approval: boolean
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
  google_task_id: string | null
  title: string
  due_date: string | null
  category: string
  status: TaskStatus
  source: TaskSource
  is_recurring: boolean
  recurrence_days: number | null
  created_at: string
}

export interface InvestmentCost {
  id: string
  owner_id: string
  category: string
  label: string | null
  amount: number
  notes: string | null
  created_at: string
}

export type TrackType = 'prime' | 'fixed_unlinked' | 'fixed_linked' | 'variable'

export interface Mortgage {
  id: string
  owner_id: string
  property_id: string | null
  lender: string | null
  notes: string | null
  created_at: string
}

export interface MortgageTrack {
  id: string
  mortgage_id: string
  owner_id: string
  label: string | null
  track_type: TrackType
  principal: number
  annual_rate: number   // effective rate as percent (prime + margin), e.g. 5.25 = 5.25%
  prime_rate: number | null  // prime/anchor component, for prime & variable tracks
  margin: number | null      // fixed margin component, for prime & variable tracks
  term_months: number
  grace_months: number
  start_date: string
  created_at: string
}

export type LoanRepaymentType = 'monthly_fixed' | 'balloon'

export interface Loan {
  id: string
  owner_id: string
  property_id: string | null
  label: string | null
  lender: string | null
  repayment_type: LoanRepaymentType
  principal: number
  annual_rate: number | null       // monthly_fixed only — drives Shpitzer schedule
  term_months: number | null       // monthly_fixed only
  grace_months: number | null      // monthly_fixed only — interest-only months at start
  start_date: string | null
  notes: string | null
  created_at: string
}

export interface InsurancePolicy {
  id: string
  owner_id: string
  property_id: string | null
  type: string
  company: string | null
  policy_number: string | null
  monthly_premium: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
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
