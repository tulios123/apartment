import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  usePropertyData,
  createContract,
  updateContract,
  deleteContract,
  upsertUtilities,
} from '../../hooks/usePropertyData'
import { useAuth } from '../../contexts/AuthContext'
import { UTILITIES } from '../../lib/constants'
import { formatDate, formatCurrency } from '../../lib/format'
import type { Contract, UtilityPayer } from '../../types'

const emptyContract = {
  company_name: '',
  contact_name: '',
  contact_phone: '',
  start_date: '',
  end_date: '',
  monthly_rent: '',
  deposit: '',
}

function ContractForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<typeof emptyContract>
  onSave: (data: typeof emptyContract) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({ ...emptyContract, ...initial })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set(k: keyof typeof emptyContract, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim() || !form.start_date || !form.end_date || !form.monthly_rent) return
    setSaving(true)
    setErr(null)
    try {
      await onSave(form)
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
        <input type="number" min="0" value={form.monthly_rent} onChange={e => set('monthly_rent', e.target.value)} required />
      </div>
      <div className="form-row">
        <label>פיקדון</label>
        <input type="number" min="0" value={form.deposit} onChange={e => set('deposit', e.target.value)} />
      </div>
      {err && <div className="form-error">{err}</div>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
      </div>
    </form>
  )
}

export default function Rental() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { property, contracts, utilities, loading, error, refetch } = usePropertyData()

  const [showContractModal, setShowContractModal] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [savingUtil, setSavingUtil] = useState(false)

  function getUtilPayer(contractId: string, utility: string): UtilityPayer {
    return utilities.find(u => u.contract_id === contractId && u.utility === utility)?.payer ?? 'tenant'
  }

  async function toggleUtil(contractId: string, utility: string, payer: UtilityPayer) {
    setSavingUtil(true)
    try {
      await upsertUtilities(contractId, [{ utility, payer }])
      refetch()
    } finally {
      setSavingUtil(false)
    }
  }

  function openNewContract() {
    setEditingContract(null)
    setShowContractModal(true)
  }

  function openEditContract(c: Contract) {
    setEditingContract(c)
    setShowContractModal(true)
  }

  async function handleContractSave(form: typeof emptyContract) {
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
      renewal_alert_days: [90, 30],
    }
    if (editingContract) {
      const { owner_id: _oi, property_id: _pi, ...updates } = payload
      await updateContract(editingContract.id, updates)
    } else {
      const contract = await createContract(payload)
      await upsertUtilities(contract.id, UTILITIES.map(u => ({ utility: u, payer: 'tenant' as UtilityPayer })))
    }
    setShowContractModal(false)
    setEditingContract(null)
    refetch()
  }

  async function handleDeleteContract(id: string) {
    if (!confirm('למחוק חוזה זה?')) return
    await deleteContract(id)
    refetch()
  }

  function daysLeft(endDate: string): number {
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  if (loading) return <div className="empty-state">טוען...</div>
  if (error) return <div className="form-error">{error}</div>

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

        {contracts.length === 0 && <div className="empty-state small">אין חוזים</div>}

        {contracts.map(c => {
          const left = daysLeft(c.end_date)
          const isActive = new Date(c.end_date) >= new Date() && new Date(c.start_date) <= new Date()
          const contractUtils = UTILITIES.map(u => ({
            utility: u,
            payer: getUtilPayer(c.id, u),
          }))

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
              </div>

              <div className="utilities-section">
                <div className="utilities-title">תשלומים שוטפים</div>
                <div className="utilities-grid">
                  {contractUtils.map(({ utility, payer }) => (
                    <div key={utility} className="utility-row">
                      <span className="utility-name">{utility}</span>
                      <div className="toggle-group small">
                        <button
                          type="button"
                          className={`toggle-btn ${payer === 'tenant' ? 'active' : ''}`}
                          onClick={() => toggleUtil(c.id, utility, 'tenant')}
                          disabled={savingUtil}
                        >שוכר</button>
                        <button
                          type="button"
                          className={`toggle-btn ${payer === 'owner' ? 'active' : ''}`}
                          onClick={() => toggleUtil(c.id, utility, 'owner')}
                          disabled={savingUtil}
                        >בעלים</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {showContractModal && (
        <div className="modal-overlay" onClick={() => setShowContractModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingContract ? 'עריכת חוזה' : 'חוזה חדש'}</h2>
              <button className="btn-icon" onClick={() => setShowContractModal(false)}>✕</button>
            </div>
            <ContractForm
              initial={editingContract ? {
                company_name: editingContract.company_name,
                contact_name: editingContract.contact_name ?? '',
                contact_phone: editingContract.contact_phone ?? '',
                start_date: editingContract.start_date,
                end_date: editingContract.end_date,
                monthly_rent: String(editingContract.monthly_rent),
                deposit: editingContract.deposit != null ? String(editingContract.deposit) : '',
              } : {}}
              onSave={handleContractSave}
              onCancel={() => { setShowContractModal(false); setEditingContract(null) }}
            />
          </div>
        </div>
      )}
    </>
  )
}
