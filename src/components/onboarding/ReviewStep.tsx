import { PencilSimple, Check, ClipboardText } from '@phosphor-icons/react'
import { formatCurrency, formatNum } from './types'
import { formatDate } from '../../lib/format'
import { useOnboarding } from './context'
import type { Step } from './types'

/**
 * הסיכום לפני השמירה — Omer's note 7, and the owner's answer on 21.09: "סיכום שאפשר לתקן".
 *
 * The wizard used to end on a congratulations screen showing four numbers, AFTER everything
 * had already been written to the database. Omer asked to be able to read back what he had
 * entered; on that screen there was nothing to read and, worse, nothing to fix — the save
 * path deliberately guards each section against a repeat write, so going "back" from there
 * and re-finishing would have silently dropped the correction.
 *
 * So the proofreading happens BEFORE the save, which is the only place it can honestly
 * happen. Every section shows what is about to be written and carries a pencil back to the
 * step that owns it; nothing here is editable in place, because a second way to edit the
 * same field is a second thing that can disagree with the first.
 *
 * Sections with nothing in them say so rather than disappearing: "no lease" is a fact worth
 * confirming, and a section that silently vanishes is exactly how a lost lease goes unnoticed.
 */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="onboarding-review-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

export function ReviewStep() {
  const {
    setStep, saving, error, confirmFinish,
    buyerName, street, city, rooms, propertySizeSqm, floorNumber,
    price, signingDate, keyDeliveryDate,
    tracks, totalPrincipal, totalMonthly, trackTypeLabel,
    loans, balloonLoans, balloonTotal, loanTypeLabel,
    equityAmount, costsTotal, costs, effPurchaseTax, effLawyer, effBrokerage, extraCosts, singleApartment,
    companyName, startDate, endDate, monthlyRent, rentPaymentMethod,
    policies, docAttachments,
  } = useOnboarding()

  // Going back is a correction, not progress — the wizard slides the other way. Using
  // setStep directly (rather than advance) keeps `navDir` on 'back'.
  const edit = (s: Step) => () => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); setStep(s) }

  const address = [street, city].filter(Boolean).join(', ')
  const rent = parseFloat(monthlyRent) || 0
  const namedCosts = [
    { label: `מס רכישה · ${singleApartment ? 'דירה יחידה' : 'דירה נוספת'}`, amount: parseFloat(effPurchaseTax) || 0 },
    { label: 'עורך דין', amount: parseFloat(effLawyer) || 0 },
    { label: 'דמי תיווך', amount: parseFloat(effBrokerage) || 0 },
    { label: 'יועץ משכנתאות', amount: parseFloat(costs.mortgage_advisor) || 0 },
    { label: 'חברת ליווי השקעה', amount: parseFloat(costs.investment_company) || 0 },
    { label: 'שמאי', amount: parseFloat(costs.appraiser) || 0 },
    ...extraCosts.map(c => ({ label: c.name || 'עלות נוספת', amount: parseFloat(c.amount) || 0 })),
  ].filter(c => c.amount > 0)

  const docCats = (['purchase', 'tabu', 'mortgage', 'loan', 'rental', 'insurance'] as const)
  const docCount = docCats.reduce((s, c) => s + docAttachments(c).length, 0)

  return (
    <div className="onboarding-review">
      <div className="onboarding-icon"><ClipboardText size={44} color="var(--accent)" /></div>
      <h2 className="onboarding-title">רגע לפני שמירה</h2>
      <p className="onboarding-subtitle">
        זה מה שנשמר. עברו על זה — כל שורה שלא נכונה, הקישו על העיפרון ותקנו.
      </p>

      <section className="onboarding-review-card">
        <div className="onboarding-review-head">
          <h3>הנכס</h3>
          <button type="button" onClick={edit('purchase')} aria-label="עריכת פרטי הרכישה"><PencilSimple size={16} /></button>
        </div>
        <Row label="כתובת" value={address || 'לא הוזנה'} />
        {buyerName && <Row label="רוכש" value={buyerName} />}
        {(rooms || propertySizeSqm || floorNumber) && (
          <Row label="הנכס" value={[
            rooms && `${rooms} חדרים`,
            propertySizeSqm && `${propertySizeSqm} מ״ר`,
            floorNumber && `קומה ${floorNumber}`,
          ].filter(Boolean).join(' · ')} />
        )}
        <Row label="מחיר רכישה" value={formatCurrency(price)} />
        <Row label="חתימת חוזה" value={signingDate ? formatDate(signingDate) : 'לא הוזן'} />
        <Row label="מסירת מפתח" value={keyDeliveryDate ? formatDate(keyDeliveryDate) : 'לא הוזן'} />
      </section>

      <section className="onboarding-review-card">
        <div className="onboarding-review-head">
          <h3>משכנתא</h3>
          <button type="button" onClick={edit('mortgage')} aria-label="עריכת המשכנתא"><PencilSimple size={16} /></button>
        </div>
        {tracks.length === 0 ? (
          <p className="onboarding-review-empty">לא הוזנה משכנתא</p>
        ) : (
          <>
            {tracks.map((t, i) => (
              <Row
                key={i}
                label={trackTypeLabel(t.track_type)}
                value={`${formatCurrency(parseFloat(t.principal) || 0)} · ${t.term_months || '—'} חודשים`}
              />
            ))}
            <Row label="סך המשכנתא" value={`${formatCurrency(totalPrincipal)} · ${formatCurrency(totalMonthly)}/חודש`} />
          </>
        )}
      </section>

      <section className="onboarding-review-card">
        <div className="onboarding-review-head">
          <h3>הלוואות</h3>
          <button type="button" onClick={edit('loans')} aria-label="עריכת ההלוואות"><PencilSimple size={16} /></button>
        </div>
        {loans.length === 0 && balloonLoans.length === 0 ? (
          <p className="onboarding-review-empty">לא הוזנו הלוואות</p>
        ) : (
          <>
            {loans.map((l, i) => (
              <Row key={i} label={l.label || l.lender || loanTypeLabel(l.repayment_type)} value={formatCurrency(parseFloat(l.principal) || 0)} />
            ))}
            {balloonTotal > 0 && <Row label={`בלון · ${balloonLoans.length}`} value={formatCurrency(balloonTotal)} />}
          </>
        )}
      </section>

      <section className="onboarding-review-card">
        <div className="onboarding-review-head">
          <h3>הון ועלויות</h3>
          <button type="button" onClick={edit('investment')} aria-label="עריכת ההון והעלויות"><PencilSimple size={16} /></button>
        </div>
        <Row label="הון עצמי" value={formatCurrency(equityAmount)} />
        {/* The EFFECTIVE values, not the typed ones. The lawyer and agent fees are shown
            in the wizard as grey computed estimates and saved exactly as displayed, so
            reading `costs.lawyer` here would have hidden two rows that the total below
            was nonetheless counting — a summary whose rows do not add up to its own sum.
            That is the same fault that was just fixed on מבנה העסקה; it does not get to
            reappear on the screen whose whole job is proofreading. */}
        {namedCosts.map(c => <Row key={c.label} label={c.label} value={formatCurrency(c.amount)} />)}
        <Row label="סך העלויות" value={formatCurrency(costsTotal)} />
      </section>

      <section className="onboarding-review-card">
        <div className="onboarding-review-head">
          <h3>שכירות</h3>
          <button type="button" onClick={edit('rental')} aria-label="עריכת השכירות"><PencilSimple size={16} /></button>
        </div>
        {rent <= 0 && !companyName ? (
          <p className="onboarding-review-empty">לא הוזן חוזה שכירות</p>
        ) : (
          <>
            <Row label="שוכר" value={companyName || 'לא הוזן'} />
            <Row label="שכר דירה" value={rent > 0 ? `₪${formatNum(monthlyRent)} לחודש` : 'לא הוזן'} />
            <Row
              label="תקופה"
              value={startDate || endDate
                ? `${startDate ? formatDate(startDate) : '—'} – ${endDate ? formatDate(endDate) : '—'}`
                : 'לא הוזנה'}
            />
            <Row label="אופן תשלום" value={rentPaymentMethod === 'check' ? 'צ׳קים' : 'העברה בנקאית'} />
          </>
        )}
      </section>

      <section className="onboarding-review-card">
        <div className="onboarding-review-head">
          <h3>ביטוח</h3>
          <button type="button" onClick={edit('insurance')} aria-label="עריכת הביטוח"><PencilSimple size={16} /></button>
        </div>
        {policies.length === 0 ? (
          <p className="onboarding-review-empty">לא הוזנה פוליסה</p>
        ) : (
          policies.map((p, i) => (
            <Row key={i} label={p.company || 'פוליסה'} value={`₪${formatNum(p.monthly_premium || '0')} לחודש`} />
          ))
        )}
      </section>

      <section className="onboarding-review-card">
        <div className="onboarding-review-head">
          <h3>מסמכים</h3>
          <button type="button" onClick={edit('documents')} aria-label="עריכת המסמכים"><PencilSimple size={16} /></button>
        </div>
        {docCount === 0 ? (
          <p className="onboarding-review-empty">לא הועלו מסמכים — אפשר להוסיף גם אחר כך</p>
        ) : (
          docCats.map(c => {
            const n = docAttachments(c).length
            if (n === 0) return null
            const label = { purchase: 'חוזה רכישה', tabu: 'נסח טאבו', mortgage: 'אישור משכנתא', loan: 'הלוואה', rental: 'חוזה שכירות', insurance: 'פוליסת ביטוח' }[c]
            return <Row key={c} label={label} value={n === 1 ? 'קובץ אחד' : `${n} קבצים`} />
          })
        )}
      </section>

      {error && <p className="onboarding-error" role="alert">{error}</p>}

      <button type="button" className="btn-onboard-primary onboarding-cta-full" onClick={confirmFinish} disabled={saving}>
        {saving ? 'שומר…' : <><Check size={15} weight="bold" /><span>הכול נכון · שמרו</span></>}
      </button>
    </div>
  )
}
