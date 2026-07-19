import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { useInvestmentData, upsertInvestmentCost, deleteInvestmentCost } from '../../hooks/useInvestmentData'
import { useLoansData } from '../../hooks/useLoansData'
import { INVESTMENT_COST_CATEGORIES } from '../../lib/constants'
import { formatCurrency } from '../../lib/format'
import { SkeletonList } from '../../components/ui/Skeleton'
import { PageError } from '../../components/ui/EmptyState'

type CostRow = {
  id?: string
  category: string
  label: string
  amount: string   // raw digits only
  isCustom: boolean
}

function fmtInput(raw: string): string {
  const n = Number(raw)
  return raw === '' || isNaN(n) ? raw : n.toLocaleString('he-IL')
}

export default function InvestmentCosts() {
  const { user } = useAuth()
  const { costs, loading, error, refetch } = useInvestmentData()
  const { summary: loansSummary } = useLoansData()

  const [rows, setRows] = useState<CostRow[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

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
        if (row.id && deletedIds.includes(row.id)) continue
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

  if (loading) return <SkeletonList rows={4} />
  if (error) return <PageError message={error} onRetry={refetch} />

  const localTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  return (
    <section className="inv-costs-section">
      <p className="prop-section-hint">סך ההון העצמי והעלויות הנלוות שהושקעו ברכישת הנכס.</p>
      <div className="prop-card">
        {rows.map((row, idx) => (
          <div key={`${row.category}-${idx}`} className="inv-cost-row">
            <span className="inv-cost-label">{row.label}</span>
            <div className="inv-cost-input-wrap">
              <input
                type="text"
                inputMode="numeric"
                className="inv-cost-input"
                value={fmtInput(row.amount)}
                onChange={e => setAmount(idx, e.target.value)}
                placeholder="0"
              />
              <span className="inv-cost-currency">₪</span>
            </div>
            {row.isCustom && (
              <button className="btn-icon danger" onClick={() => removeRow(idx)} aria-label="מחק שורה" title="מחק שורה">
                <X size={14} />
              </button>
            )}
          </div>
        ))}

        <div className="inv-cost-total">
          <span>סה״כ הושקע</span>
          <span className="inv-cost-total-amount">{formatCurrency(localTotal)}</span>
        </div>
        {loansSummary.balloonOutstanding > 0 && (
          <div className="inv-cost-net">
            <span>הון עצמי נטו (בניכוי מימון בלון)</span>
            <span className="inv-cost-total-amount">{formatCurrency(localTotal - loansSummary.balloonOutstanding)}</span>
          </div>
        )}
      </div>

      <div className="inv-add-row">
        <input
          type="text"
          aria-label="שם עלות נוספת"
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

      {saveErr && <div className="form-error" role="alert">{saveErr}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>

      {loansSummary.balloonOutstanding > 0 && (
        <p className="prop-section-hint" style={{ marginTop: 12 }}>
          מימון בלון מנוהל יחד עם ההלוואות, בקטע "משכנתא והלוואות" שמעל.
        </p>
      )}
    </section>
  )
}
