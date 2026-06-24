import { Modal } from '../../components/ui/Modal'
import { ClayIllustration } from '../../components/ui/ClayIllustration'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  usePropertyData,
  createContract,
  updateContract,
  deleteContract,
  upsertUtilities,
} from '../../hooks/usePropertyData'
import { syncRentRecurringItem, deleteRentRecurringItems } from '../../hooks/useRecurringItems'
import { useAuth } from '../../contexts/AuthContext'
import { UTILITIES } from '../../lib/constants'
import { formatDate, formatCurrency } from '../../lib/format'
import type { Contract, UtilityPayer } from '../../types'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { PageError } from '../../components/ui/EmptyState'
import { useDocuments } from '../../hooks/useDocuments'
import { getReceiptSignedUrl } from '../../lib/storage'

const emptyContract = {
  company_name: '',
  contact_name: '',
  contact_phone: '',
  start_date: '',
  end_date: '',
  monthly_rent: '',
  deposit: '',
  payment_method: 'check' as 'check' | 'bank_transfer',
  requires_approval: false,
}

type UtilDraft = { utility: string; payer: UtilityPayer; amount: number | null }

function ContractForm({
  initial,
  initialUtils,
  onSave,
  onCancel,
}: {
  initial: Partial<typeof emptyContract>
  initialUtils: UtilDraft[]
  onSave: (data: typeof emptyContract, utils: UtilDraft[]) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({ ...emptyContract, ...initial })
  const [utils, setUtils] = useState<UtilDraft[]>(initialUtils)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set(k: keyof typeof emptyContract, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function setUtilPayer(utility: string, payer: UtilityPayer) {
    setUtils(us => us.map(u => u.utility === utility ? { ...u, payer, amount: payer === 'owner' ? u.amount : null } : u))
  }
  function setUtilAmt(utility: string, raw: string) {
    const val = raw.replace(/[^\d]/g, '')
    setUtils(us => us.map(u => u.utility === utility ? { ...u, amount: val ? Number(val) : null } : u))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim() || !form.start_date || !form.end_date || !form.monthly_rent) return
    setSaving(true)
    setErr(null)
    try {
      await onSave(form, utils)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <div className="form-row">
        <label>חברה / שוכר</label>
        <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} required autoFocus />
      </div>
      <div className="form-row">
        <label>איש קשר</label>
        <input type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
      </div>
      <div className="form-row">
        <label>טלפון</label>
        <input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
      </div>
      <div className="form-row">
        <label>תחילת חוזה</label>
        <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required />
      </div>
      <div className="form-row">
        <label>סיום חוזה</label>
        <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} required />
      </div>
      <div className="form-row">
        <label>שכר דירה חודשי</label>
        <input type="text" inputMode="numeric" value={form.monthly_rent ? Number(form.monthly_rent).toLocaleString('he-IL') : ''} onChange={e => set('monthly_rent', e.target.value.replace(/[^\d]/g, ''))} required />
      </div>
      <div className="form-row">
        <label>פיקדון</label>
        <input type="text" inputMode="numeric" value={form.deposit ? Number(form.deposit).toLocaleString('he-IL') : ''} onChange={e => set('deposit', e.target.value.replace(/[^\d]/g, ''))} />
      </div>
      <div className="form-row">
        <label>אמצעי תשלום</label>
        <div className="toggle-group">
          <button type="button"
            className={`toggle-btn${form.payment_method === 'check' ? ' active' : ''}`}
            onClick={() => setForm(f => ({ ...f, payment_method: 'check' as const }))}>צ'ק</button>
          <button type="button"
            className={`toggle-btn${form.payment_method === 'bank_transfer' ? ' active' : ''}`}
            onClick={() => setForm(f => ({ ...f, payment_method: 'bank_transfer' as const }))}>העברה בנקאית</button>
        </div>
      </div>
      <div className="form-row">
        <label>אישור תשלום</label>
        <label className="toggle-row">
          <input type="checkbox" checked={form.requires_approval}
            onChange={e => setForm(f => ({ ...f, requires_approval: e.target.checked }))} />
          <span>דורש אישור ידני בכל תשלום</span>
        </label>
      </div>
      <div className="form-row">
        <label>תשלומים שוטפים</label>
        <div className="padm-util-edit">
          {utils.map(u => (
            <div key={u.utility} className="padm-util-edit-row">
              <span className="padm-util-edit-name">{u.utility}</span>
              <div className="toggle-group small">
                <button type="button" className={`toggle-btn${u.payer === 'tenant' ? ' active' : ''}`} onClick={() => setUtilPayer(u.utility, 'tenant')}>שוכר</button>
                <button type="button" className={`toggle-btn${u.payer === 'owner' ? ' active' : ''}`} onClick={() => setUtilPayer(u.utility, 'owner')}>בעלים</button>
              </div>
              {u.payer === 'owner' && (
                <input type="text" inputMode="numeric" className="utility-amount-input" placeholder="₪ סכום"
                  value={u.amount != null ? u.amount.toLocaleString('he-IL') : ''}
                  onChange={e => setUtilAmt(u.utility, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      </div>
      {err && <div className="form-error" role="alert">{err}</div>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
      </div>
    </form>
  )
}

export default function Rental({ onContractsChange }: { onContractsChange?: () => void } = {}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { property, contracts, utilities, loading, error, refetch } = usePropertyData()
  const { documents } = useDocuments()
  const rentalDocs = documents.filter(d => d.type === 'rental_contract')

  const [showContractModal, setShowContractModal] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  function getUtilPayer(contractId: string, utility: string): UtilityPayer {
    return utilities.find(u => u.contract_id === contractId && u.utility === utility)?.payer ?? 'tenant'
  }

  function getUtilAmount(contractId: string, utility: string): number | null {
    return utilities.find(u => u.contract_id === contractId && u.utility === utility)?.amount ?? null
  }

  function utilsForContract(contractId: string): UtilDraft[] {
    return UTILITIES.map(u => ({ utility: u, payer: getUtilPayer(contractId, u), amount: getUtilAmount(contractId, u) }))
  }

  function openNewContract() {
    setEditingContract(null)
    setShowContractModal(true)
  }

  function openEditContract(c: Contract) {
    setEditingContract(c)
    setShowContractModal(true)
  }

  async function handleContractSave(form: typeof emptyContract, utils: UtilDraft[]) {
    if (!user || !property) return
    const payload = {
      owner_id: user.id,
      property_id: property.id,
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      monthly_rent: parseFloat(form.monthly_rent),
      deposit: form.deposit ? parseFloat(form.deposit) : null,
      payment_method: form.payment_method,
      requires_approval: form.requires_approval,
      renewal_alert_days: [90, 30],
    }
    let contractId: string
    if (editingContract) {
      const { owner_id, property_id, ...updates } = payload
      void owner_id; void property_id
      await updateContract(editingContract.id, updates)
      contractId = editingContract.id
    } else {
      const contract = await createContract(payload)
      contractId = contract.id
    }
    await upsertUtilities(contractId, utils.map(u => ({ utility: u.utility, payer: u.payer, amount: u.payer === 'owner' ? u.amount : null })))
    // Keep the rent-collection recurring item in sync with requires_approval.
    await syncRentRecurringItem({
      id: contractId,
      monthly_rent: payload.monthly_rent,
      start_date: payload.start_date,
      end_date: payload.end_date,
      company_name: payload.company_name,
      payment_method: payload.payment_method,
      requires_approval: payload.requires_approval,
    })
    setShowContractModal(false)
    setEditingContract(null)
    refetch()
    onContractsChange?.()
  }

  async function handleDeleteContract(id: string) {
    if (!confirm('למחוק חוזה זה?')) return
    setDeleteErr(null)
    // FK is ON DELETE SET NULL, so remove the linked rent item explicitly,
    // otherwise it orphans and keeps generating rent tasks. Delete the rent item
    // first: if the contract delete then fails, the contract is recoverable (a
    // re-save re-syncs the rent item), whereas the reverse would orphan it silently.
    try {
      await deleteRentRecurringItems(id)
      await deleteContract(id)
      refetch()
      onContractsChange?.()
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'מחיקת החוזה נכשלה — נסו שוב')
      refetch()
    }
  }

  function daysLeft(endDate: string): number {
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  if (loading) return <SkeletonCard />
  if (error) return <PageError message={error} onRetry={refetch} />

  if (!property) {
    return (
      <div className="empty-state">
        <p>יש להזין פרטי נכס תחילה</p>
        <button className="btn-primary" onClick={() => navigate('/property/details')}>עבור לנכס</button>
      </div>
    )
  }

  return (
    <>
      <section className="prop-section">
        <div className="prop-section-header">
          <h2>חוזים</h2>
          <button className="btn-secondary" onClick={openNewContract}>+ חוזה חדש</button>
        </div>

        {deleteErr && <div className="form-error" role="alert">{deleteErr}</div>}

        {contracts.length === 0 && (
          <div className="empty-state-cta">
            <div className="empty-state-cta-icon"><ClayIllustration variant="document" /></div>
            <p>עדיין לא נוספו חוזי שכירות</p>
            <button className="btn-primary" onClick={openNewContract}>+ חוזה חדש</button>
          </div>
        )}

        {contracts.map(c => {
          const left = daysLeft(c.end_date)
          const isActive = new Date(c.end_date) >= new Date() && new Date(c.start_date) <= new Date()
          const contractUtils = utilsForContract(c.id)

          return (
            <div key={c.id} className={`contract-card ${isActive ? 'active' : 'expired'}`}>
              <div className="contract-card-header">
                <div className="contract-title">
                  <span className="contract-company">{c.company_name}</span>
                  {isActive && (
                    <span className={`contract-status-badge ${left <= 30 ? 'urgent' : left <= 90 ? 'warning' : ''}`}>
                      {left > 0 ? `${left} ימים` : 'פג תוקף'}
                    </span>
                  )}
                  {!isActive && <span className="contract-status-badge expired-badge">הסתיים</span>}
                </div>
                <div className="contract-card-actions">
                  <button className="btn-icon" onClick={() => openEditContract(c)} title="עריכה">
                    <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
                      <path d="M14.5 2.5a2.12 2.12 0 013 3L6 17H3v-3L14.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button className="btn-icon danger" onClick={() => handleDeleteContract(c.id)} title="מחק">
                    <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
                      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="contract-fields">
                {c.contact_name && (
                  <div className="prop-field-row">
                    <span className="prop-field-label">איש קשר</span>
                    <span>{c.contact_name}{c.contact_phone ? ` · ${c.contact_phone}` : ''}</span>
                  </div>
                )}
                <div className="prop-field-row">
                  <span className="prop-field-label">תקופה</span>
                  <span>{formatDate(c.start_date)} – {formatDate(c.end_date)}</span>
                </div>
                <div className="prop-field-row">
                  <span className="prop-field-label">שכר דירה</span>
                  <span>{formatCurrency(c.monthly_rent)} / חודש</span>
                </div>
                {c.deposit != null && (
                  <div className="prop-field-row">
                    <span className="prop-field-label">פיקדון</span>
                    <span>{formatCurrency(c.deposit)}</span>
                  </div>
                )}
                {c.payment_method && (
                  <div className="prop-field-row">
                    <span className="prop-field-label">אמצעי תשלום</span>
                    <span>{c.payment_method === 'check' ? "צ'ק" : 'העברה בנקאית'}</span>
                  </div>
                )}
                <div className="prop-field-row">
                  <span className="prop-field-label">אישור תשלום</span>
                  <span>{c.requires_approval ? 'דורש אישור ידני' : 'אוטומטי'}</span>
                </div>
              </div>

              <div className="padm-util-chips-wrap">
                <span className="prop-field-label">תשלומים שוטפים</span>
                <div className="padm-util-chips">
                  {contractUtils.map(({ utility, payer, amount }) => (
                    <span key={utility} className={`padm-util-chip ${payer}`}>
                      {utility} · {payer === 'owner' ? 'בעלים' : 'שוכר'}{payer === 'owner' && amount != null ? ` · ${formatCurrency(amount)}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {rentalDocs.length > 0 && (
        <section className="prop-section">
          <div className="prop-section-header">
            <h2>מסמכי חוזה</h2>
          </div>
          {rentalDocs.map(doc => (
            <div key={doc.id} className="prop-field-row">
              <span className="prop-field-label">{doc.name || 'חוזה שכירות'}</span>
              <button className="btn-link" onClick={async () => {
                const url = await getReceiptSignedUrl(doc.storage_path)
                window.open(url, '_blank')
              }}>פתח</button>
            </div>
          ))}
        </section>
      )}

      {showContractModal && (
        <Modal title={editingContract ? 'עריכת חוזה' : 'חוזה חדש'} onClose={() => setShowContractModal(false)}>
            <ContractForm
              initial={editingContract ? {
                company_name: editingContract.company_name,
                contact_name: editingContract.contact_name ?? '',
                contact_phone: editingContract.contact_phone ?? '',
                start_date: editingContract.start_date,
                end_date: editingContract.end_date,
                monthly_rent: String(editingContract.monthly_rent),
                deposit: editingContract.deposit != null ? String(editingContract.deposit) : '',
                payment_method: (editingContract.payment_method as 'check' | 'bank_transfer') ?? 'check',
                requires_approval: editingContract.requires_approval,
              } : {}}
              initialUtils={editingContract ? utilsForContract(editingContract.id) : UTILITIES.map(u => ({ utility: u, payer: 'tenant' as UtilityPayer, amount: null }))}
              onSave={handleContractSave}
              onCancel={() => { setShowContractModal(false); setEditingContract(null) }}
            />
        </Modal>
      )}
    </>
  )
}
