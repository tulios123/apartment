import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createProperty, createContract } from '../hooks/usePropertyData'
import { createRecurringItem } from '../hooks/useRecurringItems'

interface RecurringTemplate {
  key: string
  label: string
  category: string
  executionType: 'automatic' | 'requires_approval'
  dayOfMonth: number
  enabled: boolean
  amount: string
}

const TEMPLATES: Omit<RecurringTemplate, 'enabled' | 'amount'>[] = [
  { key: 'mortgage', label: 'משכנתא', category: 'משכנתא', executionType: 'requires_approval', dayOfMonth: 1 },
  { key: 'insurance', label: 'ביטוח', category: 'ביטוח', executionType: 'automatic', dayOfMonth: 1 },
  { key: 'vaad', label: 'ועד בית', category: 'ועד בית', executionType: 'automatic', dayOfMonth: 1 },
]

interface Props {
  onComplete: () => void
}

type Step = 0 | 1 | 2 | 3 | 4

export default function Onboarding({ onComplete }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [address, setAddress] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [recurring, setRecurring] = useState<RecurringTemplate[]>(
    TEMPLATES.map(t => ({ ...t, enabled: false, amount: '' }))
  )

  function toggleItem(key: string) {
    setRecurring(r => r.map(i => i.key === key ? { ...i, enabled: !i.enabled } : i))
  }

  function setAmount(key: string, val: string) {
    setRecurring(r => r.map(i => i.key === key ? { ...i, amount: val } : i))
  }

  async function handleFinish() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const property = await createProperty({ owner_id: user.id, address: address.trim(), notes: null })
      const contract = await createContract({
        owner_id: user.id,
        property_id: property.id,
        company_name: companyName.trim(),
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        start_date: startDate,
        end_date: endDate,
        monthly_rent: parseFloat(monthlyRent),
        deposit: null,
        renewal_alert_days: [90, 30],
      })
      for (const item of recurring.filter(i => i.enabled && i.amount)) {
        const { error: re } = await createRecurringItem({
          contract_id: contract.id,
          direction: 'expense',
          amount: parseFloat(item.amount),
          category: item.category,
          day_of_month: item.dayOfMonth,
          start_date: startDate,
          end_date: endDate,
          payee: null,
          execution_type: item.executionType,
          payment_method: null,
          renewal_alert_days: [90, 30],
        })
        if (re) throw re
      }
      setStep(4)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const TOTAL_STEPS = 3
  function dots(active: number) {
    return Array.from({ length: TOTAL_STEPS }, (_, i) => {
      const cls = i + 1 === active ? 'active' : i + 1 < active ? 'done' : ''
      return <span key={i} className={`onboarding-dot ${cls}`} />
    })
  }

  return (
    <div className="onboarding-wrap">
      <div className="onboarding-card">

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <>
            <div className="onboarding-icon">🏠</div>
            <h1 className="onboarding-title">ברוך הבא!</h1>
            <p className="onboarding-subtitle">
              בואו נגדיר את הנכס שלך ב-3 שלבים קצרים.
              <br />זה ייקח פחות מדקה.
            </p>
            <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-onboard-primary" onClick={() => setStep(1)}>
                התחל →
              </button>
            </div>
          </>
        )}

        {/* ── Step 1: Property ── */}
        {step === 1 && (
          <>
            <div className="onboarding-dots">{dots(1)}</div>
            <div className="onboarding-icon">📍</div>
            <h2 className="onboarding-title">הנכס שלך</h2>
            <p className="onboarding-subtitle">איפה הנכס?</p>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label>כתובת</label>
                <input
                  type="text"
                  placeholder="רחוב, מספר, עיר"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="onboarding-actions">
              <button className="btn-onboard-skip" onClick={() => setStep(0)}>← חזור</button>
              <button
                className="btn-onboard-primary"
                disabled={!address.trim()}
                onClick={() => setStep(2)}
              >
                הבא →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Contract ── */}
        {step === 2 && (
          <>
            <div className="onboarding-dots">{dots(2)}</div>
            <div className="onboarding-icon">📄</div>
            <h2 className="onboarding-title">פרטי החוזה</h2>
            <p className="onboarding-subtitle">מי השוכר ומה תנאי השכירות?</p>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label>שם חברה / שוכר</label>
                <input
                  type="text"
                  placeholder="שם החברה או השוכר"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>איש קשר</label>
                  <input
                    type="text"
                    placeholder="שם (אופציונלי)"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                  />
                </div>
                <div className="onboarding-field">
                  <label>טלפון</label>
                  <input
                    type="tel"
                    placeholder="050-... (אופציונלי)"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>תאריך התחלה</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>תאריך סיום</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-field">
                <label>שכירות חודשית (₪)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={monthlyRent}
                  onChange={e => setMonthlyRent(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div className="onboarding-actions">
              <button className="btn-onboard-skip" onClick={() => setStep(1)}>← חזור</button>
              <button
                className="btn-onboard-primary"
                disabled={!companyName.trim() || !startDate || !endDate || !monthlyRent}
                onClick={() => setStep(3)}
              >
                הבא →
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Recurring items ── */}
        {step === 3 && (
          <>
            <div className="onboarding-dots">{dots(3)}</div>
            <div className="onboarding-icon">🔄</div>
            <h2 className="onboarding-title">תשלומים קבועים</h2>
            <p className="onboarding-subtitle">
              אילו הוצאות חוזרות יש לך? סמן והזן סכום.
            </p>
            <div className="onboarding-recurring-list">
              {recurring.map(item => (
                <div
                  key={item.key}
                  className={`onboarding-recurring-item${item.enabled ? ' on' : ''}`}
                  onClick={() => toggleItem(item.key)}
                >
                  <div className="onboarding-check">{item.enabled && '✓'}</div>
                  <span className="onboarding-recurring-label">{item.label}</span>
                  <input
                    className="onboarding-recurring-amount"
                    type="number"
                    placeholder="₪"
                    value={item.amount}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { setAmount(item.key, e.target.value); if (!item.enabled) toggleItem(item.key) }}
                    min="0"
                  />
                </div>
              ))}
            </div>
            {error && <p className="onboarding-error">{error}</p>}
            <div className="onboarding-actions">
              <button className="btn-onboard-skip" onClick={() => setStep(2)}>← חזור</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-onboard-skip" onClick={handleFinish} disabled={saving}>
                  דלג
                </button>
                <button className="btn-onboard-primary" onClick={handleFinish} disabled={saving}>
                  {saving ? 'שומר...' : 'סיום ✓'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 4: Done ── */}
        {step === 4 && (
          <>
            <div className="onboarding-done-icon">🎉</div>
            <h2 className="onboarding-title">הכל מוכן!</h2>
            <p className="onboarding-subtitle">
              הנכס שלך הוגדר בהצלחה.<br />
              תוכל לערוך כל פרט בכל עת.
            </p>
            <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-onboard-primary" onClick={onComplete}>
                למסך הראשי →
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
