import { useRef, useState } from 'react'
import { sanitizeAmountInt } from '../../lib/format'
import { Tag, CaretDown } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { DocFileList } from './DocFileList'
import { emptyTrack, formatPrice } from './types'
import { purchaseWarnings } from './validation'
import { useOnboarding } from './context'
import { DateField } from '../ui/DateField'

export function PurchaseStep() {
  const {
    advance, setTrackForm, keyDeliveryDate,
    buyerName, setBuyerName, street, setStreet, city, setCity,
    rooms, setRooms, purchasePrice, setPurchasePrice,
    signingDate, setSigningDate, setKeyDeliveryDate,
    propertySizeSqm, setPropertySizeSqm, floorNumber, setFloorNumber,
    purchaseAiBusy, purchaseAiErr, purchaseAiDone, aiFillPurchase,
    purchaseDocFiles, removeDocFile, renameDocFile,
    fillTestPurchase,
  } = useOnboarding()
  const purchaseDocRef = useRef<HTMLInputElement>(null)
  const [showDocs, setShowDocs] = useState(false)

  // Live plausibility hints — everything here is optional, so nothing blocks;
  // a thousands-slip price or an inverted signing/key-delivery pair just asks.
  const warnings = purchaseWarnings({ purchasePrice, signingDate, keyDeliveryDate })

  return (
    <form onSubmit={e => {
      e.preventDefault()
      setTrackForm(emptyTrack(keyDeliveryDate || undefined))
      advance('mortgage')
    }} noValidate>
      <StepHeader current="purchase" icon={<Tag size={44} color="var(--accent)" />} title="פרטי רכישה" />
      <FillExampleTop onFill={fillTestPurchase} />

      <div className="onboarding-ai-fill">
        <button type="button" className={`btn-onboard-ai${purchaseAiDone && !purchaseAiBusy ? ' is-done' : ''}`} disabled={purchaseAiBusy}
          onClick={() => { if (purchaseAiBusy) return; purchaseDocFiles.length ? setShowDocs(o => !o) : purchaseDocRef.current?.click() }}
          aria-expanded={purchaseDocFiles.length ? showDocs : undefined}>
          {purchaseAiBusy
            ? 'קורא את החוזה…'
            : purchaseDocFiles.length
              ? <>📎 {purchaseDocFiles.length} {purchaseDocFiles.length === 1 ? 'קובץ הועלה' : 'קבצים הועלו'} — הקישו לצפייה <CaretDown size={15} weight="bold" className={`onboarding-ai-caret${showDocs ? ' is-open' : ''}`} /></>
              : '📄 העלו חוזה רכישה — מילוי אוטומטי'}
        </button>
        <input ref={purchaseDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) aiFillPurchase(fs); e.target.value = '' }} />
        {showDocs && <DocFileList files={purchaseDocFiles} onFiles={aiFillPurchase} onRemove={i => removeDocFile('purchase', i)} onRename={(i, name) => renameDocFile('purchase', i, name)} />}
        {purchaseAiErr && <p className="onboarding-error" role="alert">{purchaseAiErr}</p>}
        <p className="onboarding-subtitle onboarding-optional" style={{ marginTop: 6 }}>אפשר כמה צילומי מסך יחד · או מלאו ידנית למטה</p>
      </div>

      <div className="onboarding-form">
        <div className="onboarding-field">
          <label>שם הרוכש</label>
          <input type="text" placeholder="שם מלא" value={buyerName}
            onChange={e => setBuyerName(e.target.value)} />
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>רחוב</label>
            <input type="text" placeholder="רחוב ומספר" value={street}
              onChange={e => setStreet(e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label>עיר</label>
            <input type="text" placeholder="עיר" value={city}
              onChange={e => setCity(e.target.value)} />
          </div>
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>שטח (מ&quot;ר)</label>
            <input type="number" placeholder="0" min="0" value={propertySizeSqm}
              onChange={e => setPropertySizeSqm(e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label>קומה</label>
            <input type="number" placeholder="0" value={floorNumber}
              onChange={e => setFloorNumber(e.target.value)} />
          </div>
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>מספר חדרים</label>
            <input type="number" placeholder="0" min="0" step="0.5" value={rooms}
              onChange={e => setRooms(e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label>מחיר רכישה (₪)</label>
            <input type="text" inputMode="numeric" placeholder="0"
              value={formatPrice(purchasePrice)}
              onChange={e => setPurchasePrice(sanitizeAmountInt(e.target.value))} />
          </div>
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>תאריך חתימת חוזה</label>
            <DateField value={signingDate} onChange={setSigningDate} ariaLabel="תאריך חתימת חוזה" />
          </div>
          <div className="onboarding-field">
            <label>מסירת מפתח</label>
            <DateField value={keyDeliveryDate} onChange={setKeyDeliveryDate} ariaLabel="מסירת מפתח" />
          </div>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="onboarding-soft-warning" style={{ marginBottom: 10 }}>
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
      <button type="submit" className="btn-onboard-primary onboarding-cta-full">המשך</button>
    </form>
  )
}
