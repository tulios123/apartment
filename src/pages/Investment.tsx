import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useInvestmentData, upsertInvestmentCost, deleteInvestmentCost } from '../hooks/useInvestmentData'
import { useMortgageData } from '../hooks/useMortgageData'
import { useInsurance } from '../hooks/useInsurance'
import { usePropertyData } from '../hooks/usePropertyData'
import { monthlyPayment } from '../lib/mortgage'
import { INVESTMENT_COST_CATEGORIES } from '../lib/constants'
import { formatCurrency } from '../lib/format'

type CostRow = {
  id?: string
  category: string
  label: string
  amount: string   // raw digits only
  isCustom: boolean
}

function fmtInput(raw: string): string {
  const n = Number(raw)
  return raw === '' || isNaN(n) ? raw : n.toLocaleString('en-US')
}

function elapsedMonths(startStr: string | null, endStr: string | null): number {
  if (!startStr) return 0
  const start = new Date(startStr)
  const end = endStr ? new Date(Math.min(new Date(endStr).getTime(), Date.now())) : new Date()
  if (end <= start) return 0
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}

export default function InvestmentPage() {
  const { user } = useAuth()
  const { costs, totalInvested, rentReceived, interestPaid, maintenance, loading, error, refetch } = useInvestmentData()
  const { summary: mortgageSummary, tracks, loading: mortLoading } = useMortgageData()
  const { policies, loading: insLoading } = useInsurance()
  const { contracts, loading: propLoading } = usePropertyData()

  const [rows, setRows] = useState<CostRow[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [costsOpen, setCostsOpen] = useState(false)
  const [graceView, setGraceView] = useState<'grace' | 'post'>('grace')

  // Sync rows from DB whenever costs updates
  useEffect(() => {
    const standard = INVESTMENT_COST_CATEGORIES.map(cat => {
      const existing = costs.find(c => c.category === cat.value)
      return {
        id: existing?.id,
        category: cat.value,
        label: cat.label,
        amount: existing ? String(Math.round(existing.amount)) : '',
        isCustom: false,
      }
    })
    const custom = costs
      .filter(c => c.category === 'other')
      .map(c => ({
        id: c.id,
        category: 'other',
        label: c.label ?? 'אחר',
        amount: String(Math.round(c.amount)),
        isCustom: true,
      }))
    setRows([...standard, ...custom])
    setDeletedIds([])
  }, [costs])

  function setAmount(idx: number, val: string) {
    setRows(r => r.map((row, i) => i === idx ? { ...row, amount: val.replace(/[^\d]/g, '') } : row))
  }

  function removeRow(idx: number) {
    const row = rows[idx]
    if (row.id) setDeletedIds(ids => [...ids, row.id!])
    setRows(r => r.filter((_, i) => i !== idx))
  }

  function addCustomRow() {
    const label = newLabel.trim()
    if (!label) return
    setRows(r => [...r, { category: 'other', label, amount: '', isCustom: true }])
    setNewLabel('')
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setSaveErr(null)
    try {
      for (const id of deletedIds) {
        await deleteInvestmentCost(id)
      }
      for (const row of rows) {
        const amount = parseFloat(row.amount) || 0
        if (amount > 0) {
          await upsertInvestmentCost({
            id: row.id,
            owner_id: user.id,
            category: row.category,
            label: row.isCustom ? row.label : null,
            amount,
          })
        } else if (row.id) {
          await deleteInvestmentCost(row.id)
        }
      }
      await refetch()
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  if (loading || mortLoading || insLoading || propLoading) return <div className="empty-state">טוען...</div>
  if (error) return <div className="form-error">{error}</div>

  const monthlyInsurance = policies.reduce((s, p) => s + (p.monthly_premium ?? 0), 0)
  const insurancePaidToDate = policies.reduce((s, p) =>
    s + (p.monthly_premium ?? 0) * elapsedMonths(p.start_date, p.end_date), 0)

  const now = new Date()
  const activeContract = contracts.find(c => new Date(c.start_date) <= now && new Date(c.end_date) >= now)
  const monthlyRent = activeContract?.monthly_rent ?? null

  const hasGrace = tracks.some(t => (t.grace_months ?? 0) > 0)
  const gracePeriodPayment = hasGrace
    ? tracks.reduce((s, t) => {
        const r = t.annual_rate / 100 / 12
        return s + ((t.grace_months ?? 0) > 0
          ? t.principal * r
          : monthlyPayment(t.principal, t.annual_rate, t.term_months, 0))
      }, 0)
    : 0
  const monthlyMortgage = mortgageSummary.monthlyPayment
  const selectedMortgage = hasGrace
    ? (graceView === 'grace' ? gracePeriodPayment : monthlyMortgage)
    : monthlyMortgage
  const monthlyNet = (monthlyRent ?? 0) - selectedMortgage - monthlyInsurance

  const netPosition = rentReceived - interestPaid - insurancePaidToDate - maintenance
  const localTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  return (
    <>
      {/* ── Summary cards ── */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">סה״כ הושקע</div>
          <div className="summary-amount">{formatCurrency(totalInvested)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">שכירות שהתקבלה</div>
          <div className="summary-amount positive">{formatCurrency(rentReceived)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">מצב נקי מצטבר</div>
          <div className={`summary-amount ${netPosition >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(netPosition)}
          </div>
          <div className="inv-sub-label">שכירות פחות ריבית, ביטוח ותחזוקה</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">ריבית ששולמה</div>
          <div className="summary-amount negative">{formatCurrency(interestPaid)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">ביטוח ששולם</div>
          <div className="summary-amount negative">{formatCurrency(insurancePaidToDate)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">תחזוקה</div>
          <div className="summary-amount negative">{formatCurrency(maintenance)}</div>
        </div>
      </div>

      {/* ── Monthly cash flow ── */}
      <section className="inv-costs-section">
        <div className="inv-flow-header">
          <h2>תזרים חודשי</h2>
          {hasGrace && (
            <div className="toggle-group">
              <button type="button"
                className={`toggle-btn${graceView === 'grace' ? ' active' : ''}`}
                onClick={() => setGraceView('grace')}>בגרייס</button>
              <button type="button"
                className={`toggle-btn${graceView === 'post' ? ' active' : ''}`}
                onClick={() => setGraceView('post')}>לאחר גרייס</button>
            </div>
          )}
        </div>
        <div className="prop-card">
          <div className="inv-flow-row">
            <span className="inv-flow-sign positive">+</span>
            <span className="inv-flow-label">שכ״ד</span>
            <span className="inv-flow-amount positive">
              {monthlyRent != null ? formatCurrency(monthlyRent) : <span className="text-muted">אין חוזה פעיל</span>}
            </span>
          </div>
          <div className="inv-flow-row">
            <span className="inv-flow-sign negative">−</span>
            <span className="inv-flow-label">משכנתא</span>
            <span className="inv-flow-amount negative">
              {selectedMortgage > 0 ? formatCurrency(selectedMortgage) : <span className="text-muted">—</span>}
            </span>
          </div>
          <div className="inv-flow-row">
            <span className="inv-flow-sign negative">−</span>
            <span className="inv-flow-label">ביטוח</span>
            <span className="inv-flow-amount negative">{monthlyInsurance > 0 ? formatCurrency(monthlyInsurance) : <span className="text-muted">—</span>}</span>
          </div>
          <div className="inv-flow-divider" />
          <div className="inv-flow-row inv-flow-total">
            <span className="inv-flow-sign">=</span>
            <span className="inv-flow-label">נטו חודשי</span>
            <span className={`inv-flow-amount ${monthlyNet >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(monthlyNet)}
            </span>
          </div>
        </div>
      </section>

      {/* ── כמה הושקע ── */}
      <section className="inv-costs-section">
        <button className="inv-collapse-header" onClick={() => setCostsOpen(o => !o)}>
          <h2>כמה הושקע</h2>
          <div className="inv-collapse-right">
            <span className="inv-collapse-total">{formatCurrency(localTotal)}</span>
            <span className={`inv-collapse-chevron${costsOpen ? ' open' : ''}`}>›</span>
          </div>
        </button>

        {costsOpen && (
          <>
            <div className="prop-card">
              {rows.map((row, idx) => (
                <div key={`${row.category}-${idx}`} className="inv-cost-row">
                  <span className="inv-cost-label">{row.label}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="inv-cost-input"
                    value={fmtInput(row.amount)}
                    onChange={e => setAmount(idx, e.target.value)}
                    placeholder="0"
                  />
                  {row.isCustom && (
                    <button className="btn-icon danger" onClick={() => removeRow(idx)} title="מחק שורה">
                      <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              <div className="inv-cost-total">
                <span>סה״כ הושקע</span>
                <span className="inv-cost-total-amount">{formatCurrency(localTotal)}</span>
              </div>
            </div>

            <div className="inv-add-row">
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomRow()}
                placeholder="שם עלות נוספת"
                className="inv-add-input"
              />
              <button className="btn-secondary" onClick={addCustomRow} disabled={!newLabel.trim()}>
                + הוסף עלות
              </button>
            </div>

            {saveErr && <div className="form-error">{saveErr}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  )
}
