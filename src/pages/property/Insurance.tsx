import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useInsurance, createInsurancePolicy, updateInsurancePolicy, deleteInsurancePolicy } from '../../hooks/useInsurance'
import { usePropertyData } from '../../hooks/usePropertyData'
import { formatCurrency, formatDate } from '../../lib/format'
import type { InsurancePolicy } from '../../types'

const INSURANCE_TYPES = ['מבנה', 'חיים', 'משכנתא', 'תכולה', 'אחר']

const emptyForm = {
  type: 'מבנה',
  company: '',
  policy_number: '',
  monthly_premium: '',
  start_date: '',
  end_date: '',
  notes: '',
}

function InsuranceForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: typeof emptyForm
  onSave: (data: typeof emptyForm) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function set(k: keyof typeof emptyForm, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
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
        <label>סוג ביטוח</label>
        <div className="toggle-group">
          {INSURANCE_TYPES.map(t => (
            <button key={t} type="button"
              className={`toggle-btn${form.type === t ? ' active' : ''}`}
              onClick={() => set('type', t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label>חברת ביטוח</label>
        <input type="text" value={form.company} autoFocus
          onChange={e => set('company', e.target.value)} placeholder="שם החברה" />
      </div>
      <div className="form-row">
        <label>מספר פוליסה</label>
        <input type="text" value={form.policy_number}
          onChange={e => set('policy_number', e.target.value)} placeholder="אופציונלי" />
      </div>
      <div className="form-row">
        <label>פרמיה חודשית (₪)</label>
        <input type="text" inputMode="numeric" value={form.monthly_premium ? Number(form.monthly_premium).toLocaleString('en-US') : ''} onChange={e => set('monthly_premium', e.target.value.replace(/[^\d]/g, ''))} placeholder="0" />
      </div>
      <div className="form-2col">
        <div className="form-row">
          <label>תאריך התחלה</label>
          <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div className="form-row">
          <label>תאריך סיום</label>
          <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <label>הערות</label>
        <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      {err && <div className="form-error">{err}</div>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
      </div>
    </form>
  )
}

export default function Insurance() {
  const { user } = useAuth()
  const { property } = usePropertyData()
  const { policies, loading, error, refetch } = useInsurance()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InsurancePolicy | null>(null)

  function openNew() {
    setEditing(null)
    setShowModal(true)
  }

  function openEdit(p: InsurancePolicy) {
    setEditing(p)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
  }

  async function handleSave(form: typeof emptyForm) {
    if (!user) return
    const payload = {
      owner_id: user.id,
      property_id: property?.id ?? null,
      type: form.type,
      company: form.company.trim() || null,
      policy_number: form.policy_number.trim() || null,
      monthly_premium: form.monthly_premium ? parseFloat(form.monthly_premium) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      await updateInsurancePolicy(editing.id, payload)
    } else {
      await createInsurancePolicy(payload)
    }
    closeModal()
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק פוליסה זו?')) return
    await deleteInsurancePolicy(id)
    refetch()
  }

  function daysUntilRenewal(endDate: string): number {
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  const totalMonthly = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)

  if (loading) return <div className="empty-state">טוען...</div>
  if (error) return <div className="form-error">{error}</div>

  return (
    <>
      <div className="sub-page-actions">
        <button className="btn-primary" onClick={openNew}>+ פוליסה חדשה</button>
        {policies.length > 0 && (
          <span className="sub-page-summary">סה״כ: {formatCurrency(totalMonthly)} / חודש</span>
        )}
      </div>

      {policies.length === 0 && (
        <div className="empty-state-cta">
          <div className="empty-state-cta-icon">🛡️</div>
          <p>עדיין לא הוספת פוליסות ביטוח</p>
          <button className="btn-primary" onClick={openNew}>+ הוסף פוליסה</button>
        </div>
      )}

      {policies.map(p => {
        const daysLeft = p.end_date ? daysUntilRenewal(p.end_date) : null
        const isExpiringSoon = daysLeft != null && daysLeft <= 30 && daysLeft > 0
        const isExpired = daysLeft != null && daysLeft <= 0

        return (
          <div key={p.id} className={`contract-card${isExpired ? ' expired' : ''}`}>
            <div className="contract-card-header">
              <div className="contract-title">
                <span className="contract-company">ביטוח {p.type}</span>
                {p.company && <span className="text-muted" style={{ fontSize: '0.85rem' }}> · {p.company}</span>}
                {isExpired && <span className="contract-status-badge expired-badge">פג תוקף</span>}
                {isExpiringSoon && <span className="contract-status-badge urgent">{daysLeft} ימים לחידוש</span>}
              </div>
              <div className="contract-card-actions">
                <button className="btn-icon" onClick={() => openEdit(p)} title="עריכה">
                  <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
                    <path d="M14.5 2.5a2.12 2.12 0 013 3L6 17H3v-3L14.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="btn-icon danger" onClick={() => handleDelete(p.id)} title="מחק">
                  <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="contract-fields">
              {p.policy_number && (
                <div className="prop-field-row">
                  <span className="prop-field-label">מספר פוליסה</span>
                  <span>{p.policy_number}</span>
                </div>
              )}
              {p.monthly_premium != null && (
                <div className="prop-field-row">
                  <span className="prop-field-label">פרמיה חודשית</span>
                  <span>{formatCurrency(p.monthly_premium)}</span>
                </div>
              )}
              {(p.start_date || p.end_date) && (
                <div className="prop-field-row">
                  <span className="prop-field-label">תקופה</span>
                  <span>
                    {p.start_date ? formatDate(p.start_date) : '—'}
                    {p.end_date ? ` – ${formatDate(p.end_date)}` : ''}
                  </span>
                </div>
              )}
              {p.notes && (
                <div className="prop-field-row">
                  <span className="prop-field-label">הערות</span>
                  <span>{p.notes}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'עריכת פוליסה' : 'פוליסה חדשה'}</h2>
              <button className="btn-icon" onClick={closeModal}>✕</button>
            </div>
            <InsuranceForm
              initial={editing ? {
                type: editing.type,
                company: editing.company ?? '',
                policy_number: editing.policy_number ?? '',
                monthly_premium: editing.monthly_premium != null ? String(editing.monthly_premium) : '',
                start_date: editing.start_date ?? '',
                end_date: editing.end_date ?? '',
                notes: editing.notes ?? '',
              } : emptyForm}
              onSave={handleSave}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}
    </>
  )
}
