import { useRef, useState } from 'react'
import { userErrorMessage } from '../../lib/errorHe'
import type { Property } from '../../types'
import { DateField } from '../../components/ui/DateField'
import { caretIndexAfterDigits, sanitizeAmountInt } from '../../lib/format'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { uploadDocument } from '../../lib/storage'
import { isManager } from '../../lib/admin'

type PropertyFields = Partial<Omit<Property, 'id' | 'owner_id' | 'created_at'>>

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

// Manager/dev accounts never bill the Claude API — mirror the onboarding DEV_MOCK
// contract so testing the scan here is free too (real family users hit the model).
const DEMO_CONTRACT: Record<string, unknown> = {
  buyerName: 'ישראל ישראלי (דמו)', street: 'הרצל 10', city: 'תל אביב',
  purchasePrice: 2500000, purchaseDate: '2025-01-15', keyDeliveryDate: '2025-07-01',
  propertySizeSqm: 90, floor: 3, rooms: 4,
}

function parseAddress(address: string): [string, string] {
  const comma = address.indexOf(', ')
  return comma > -1 ? [address.slice(0, comma), address.slice(comma + 2)] : [address, '']
}

function parseBlockParcel(bp: string): [string, string] {
  const m = bp.match(/גוש (.+?) חלקה (.+)/)
  return m ? [m[1], m[2]] : ['', '']
}

function formatPrice(raw: string) {
  const n = Number(raw.replace(/,/g, ''))
  return raw === '' || isNaN(n) ? raw : n.toLocaleString('he-IL')
}

// Handles a formatted-money <input>'s onChange: strips non-digits into the
// stored value, then re-formats the DOM input directly and restores the
// caret to the same digit position it was at before re-grouping (see
// caretIndexAfterDigits — without this the caret jumps to the end on every
// keystroke, which makes correcting a digit in a large number uncomfortable).
function handleMoneyChange(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) {
  const input = e.target
  const caret = input.selectionStart ?? input.value.length
  const digitsBeforeCaret = (input.value.slice(0, caret).match(/\d/g) || []).length
  const digits = sanitizeAmountInt(input.value)
  const formatted = digits ? formatPrice(digits) : ''
  input.value = formatted
  const pos = caretIndexAfterDigits(formatted, digitsBeforeCaret)
  input.setSelectionRange(pos, pos)
  setter(digits)
}

export function PropertyForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<Property>
  onSave: (data: PropertyFields) => Promise<void>
  onCancel: () => void
}) {
  const [addrStreet, addrCity] = parseAddress(initial.address ?? '')
  const [bpBlock, bpParcel] = parseBlockParcel(initial.block_parcel ?? '')

  const [street, setStreet] = useState(addrStreet)
  const [city, setCity] = useState(addrCity)
  const [block, setBlock] = useState(bpBlock)
  const [parcel, setParcel] = useState(bpParcel)
  const [buyerName, setBuyerName] = useState(initial.buyer_name ?? '')
  const [purchasePrice, setPurchasePrice] = useState(
    initial.purchase_price != null ? String(initial.purchase_price) : ''
  )
  const [estimatedValue, setEstimatedValue] = useState(
    initial.estimated_value != null ? String(initial.estimated_value) : ''
  )
  const [purchaseDate, setPurchaseDate] = useState(initial.purchase_date ?? '')
  const [keyDeliveryDate, setKeyDeliveryDate] = useState(initial.key_delivery_date ?? '')
  const [floor, setFloor] = useState(initial.floor != null ? String(initial.floor) : '')
  const [rooms, setRooms] = useState(initial.rooms != null ? String(initial.rooms) : '')
  const [sizeSqm, setSizeSqm] = useState(
    initial.property_size_sqm != null ? String(initial.property_size_sqm) : ''
  )
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // ── AI scan: upload a purchase contract → (1) save the file as a document of this
  // property RIGHT AWAY (automatic, not tied to the form's Save button), and (2) fill
  // the fields via the same extract-contract function the onboarding step uses. The
  // filled field values are still only committed on "שמור" so the user reviews them.
  const { user } = useAuth()
  const propertyId = initial.id           // present when editing; absent for a new property
  const useMockExtraction = import.meta.env.DEV || isManager(user?.email)
  const fileRef = useRef<HTMLInputElement>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState<string | null>(null)
  const [aiDone, setAiDone] = useState(false)
  const [docSaved, setDocSaved] = useState(false)

  // Persist the uploaded file(s) as documents of this property immediately. Only
  // possible once the property exists (edit) — a brand-new property has no id to
  // attach to yet, so we scan-only there and the file can be added after saving.
  async function saveDocs(fileList: File[]) {
    if (!propertyId || !user) return
    await Promise.all(fileList.map(async f => {
      const docId = crypto.randomUUID()
      const path = await uploadDocument(f, docId, user.id)
      const { error } = await supabase.from('documents').insert({
        id: docId, owner_id: user.id, property_id: propertyId,
        contract_id: null, transaction_id: null,
        type: 'purchase_contract', name: f.name, storage_path: path,
        date: purchaseDate || null,
      })
      if (error) throw error
    }))
    setDocSaved(true)
  }

  async function aiFill(fileList: File[]) {
    if (!fileList.length) return
    setAiBusy(true); setAiErr(null); setAiDone(false); setDocSaved(false)
    // Auto-save the file(s) in parallel with the scan — independent, so a save failure
    // doesn't block the auto-fill and vice-versa.
    const saved = saveDocs(fileList).catch(() => setAiErr(prev => prev ?? 'הקובץ לא נשמר כמסמך — אפשר לצרף אותו שוב ממסך המסמכים.'))
    try {
      const files = await Promise.all(fileList.map(async f => ({ fileBase64: await fileToBase64(f), mediaType: f.type })))
      let data: Record<string, unknown> | null = null
      if (useMockExtraction) {
        await new Promise(r => setTimeout(r, 700))
        data = DEMO_CONTRACT
      } else {
        const res = await supabase.functions.invoke('extract-contract', { body: { files } })
        if (res.error) throw res.error
        data = res.data
      }
      const d: Record<string, unknown> = data ?? {}
      if (d.buyerName) setBuyerName(String(d.buyerName))
      // Prefer the separately-extracted street/city; fall back to splitting a full address.
      if (d.street || d.city) {
        if (d.street) setStreet(String(d.street))
        if (d.city) setCity(String(d.city))
      } else if (d.propertyAddress) {
        const addr = String(d.propertyAddress)
        const ci = addr.lastIndexOf(',')
        if (ci > 0) { setStreet(addr.slice(0, ci).trim()); setCity(addr.slice(ci + 1).trim()) }
        else setStreet(addr)
      }
      if (d.blockParcel) {
        const [b, p] = parseBlockParcel(String(d.blockParcel))
        if (b) setBlock(b)
        if (p) setParcel(p)
      }
      if (d.purchasePrice != null) setPurchasePrice(String(d.purchasePrice))
      if (d.purchaseDate) setPurchaseDate(String(d.purchaseDate))
      if (d.keyDeliveryDate) setKeyDeliveryDate(String(d.keyDeliveryDate))
      if (d.propertySizeSqm != null) setSizeSqm(String(d.propertySizeSqm))
      if (d.floor != null) setFloor(String(d.floor))
      if (d.rooms != null) setRooms(String(d.rooms))
      setAiDone(true)
    } catch {
      setAiErr(prev => prev ?? 'לא הצלחנו לקרוא את החוזה — נסו שוב או מלאו ידנית.')
    } finally {
      await saved            // keep "busy" until the auto-save settles too
      setAiBusy(false)
    }
  }

  function validate(): string | null {
    if (!street.trim()) return 'יש להזין את הרחוב'
    if (!city.trim()) return 'יש להזין את העיר'
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) { setErr(problem); return }
    setSaving(true)
    setErr(null)
    try {
      await onSave({
        address: `${street.trim()}, ${city.trim()}`,
        notes: notes.trim() || null,
        buyer_name: buyerName.trim() || null,
        block_parcel: block && parcel ? `גוש ${block.trim()} חלקה ${parcel.trim()}` : null,
        purchase_price: purchasePrice ? Number(purchasePrice.replace(/,/g, '')) : null,
        estimated_value: estimatedValue ? Number(estimatedValue.replace(/,/g, '')) : null,
        purchase_date: purchaseDate || null,
        key_delivery_date: keyDeliveryDate || null,
        floor: floor ? Number(floor) : null,
        rooms: rooms ? Number(rooms) : null,
        property_size_sqm: sizeSqm ? Number(sizeSqm) : null,
      })
    } catch (e) {
      setErr(userErrorMessage(e, 'לא הצלחנו לשמור — נסו שוב'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="form" noValidate>
      {/* AI scan: upload the purchase contract to auto-fill the fields below. */}
      <div className="prop-ai-scan">
        <button
          type="button"
          className={`prop-ai-scan-btn${aiDone && !aiBusy ? ' is-done' : ''}`}
          disabled={aiBusy}
          onClick={() => fileRef.current?.click()}
        >
          {aiBusy
            ? (propertyId ? 'שומר וקורא…' : 'קורא את החוזה…')
            : aiDone
              ? (docSaved ? '✓ נשמר ומולא — בדקו ותקנו' : '✓ מולא — בדקו ותקנו')
              : (propertyId ? '📄 העלו חוזה רכישה — שמירה + מילוי אוטומטי' : '📄 העלו חוזה רכישה — מילוי אוטומטי')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) aiFill(fs); e.target.value = '' }}
        />
        {aiErr && <div className="form-error" role="alert">{aiErr}</div>}
        <p className="form-hint" style={{ marginTop: 6 }}>
          {propertyId
            ? 'הקובץ יישמר אוטומטית כמסמך של הנכס, ויזהה כתובת, מחיר, תאריכים, גוש/חלקה, קומה ומ״ר. אפשר לתקן לפני השמירה.'
            : 'יזהה כתובת, מחיר, תאריכים, גוש/חלקה, קומה ומ״ר. אפשר לתקן לפני השמירה.'}
        </p>
      </div>

      <div className="form-section-label">פרטי הנכס</div>
      <p className="form-req-note">שדות עם <span className="req-star">*</span> הם חובה — כל השאר אפשר להשלים אחר כך.</p>
      <div className="form-2col">
        <div className="form-row">
          <label>רחוב<span className="req-star">*</span></label>
          <input type="text" value={street} onChange={e => setStreet(e.target.value)} required autoFocus placeholder="רחוב ומספר" />
        </div>
        <div className="form-row">
          <label>עיר<span className="req-star">*</span></label>
          <input type="text" value={city} onChange={e => setCity(e.target.value)} required />
        </div>
      </div>
      <div className="form-2col">
        <div className="form-row">
          <label>גוש</label>
          <input type="text" value={block} onChange={e => setBlock(e.target.value)} inputMode="numeric" />
        </div>
        <div className="form-row">
          <label>חלקה</label>
          <input type="text" value={parcel} onChange={e => setParcel(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <div className="form-3col">
        <div className="form-row">
          <label>קומה</label>
          <input type="number" min="0" value={floor} onChange={e => setFloor(e.target.value)} placeholder="0" />
        </div>
        <div className="form-row">
          <label>חדרים</label>
          <input type="number" min="0" step="0.5" value={rooms} onChange={e => setRooms(e.target.value)} placeholder="0" />
        </div>
        <div className="form-row">
          <label>מ"ר</label>
          <input type="number" min="0" value={sizeSqm} onChange={e => setSizeSqm(e.target.value)} placeholder="0" />
        </div>
      </div>

      <div className="form-section-label">פרטי רכישה</div>
      <div className="form-row">
        <label>שם הקונה</label>
        <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="שם מלא" />
      </div>
      <div className="form-2col">
        <div className="form-row">
          <label>מחיר רכישה (₪)</label>
          <input
            type="text"
            inputMode="numeric"
            value={purchasePrice ? formatPrice(purchasePrice) : ''}
            onChange={e => handleMoneyChange(e, setPurchasePrice)}
            placeholder="0"
          />
        </div>
        <div className="form-row">
          <label>שווי נכס נוכחי (₪)</label>
          <input
            type="text"
            inputMode="numeric"
            value={estimatedValue ? formatPrice(estimatedValue) : ''}
            onChange={e => handleMoneyChange(e, setEstimatedValue)}
            placeholder={purchasePrice ? formatPrice(purchasePrice) : '0'}
          />
        </div>
      </div>
      <p className="form-hint">שווי השוק העדכני — משמש לחישוב ההון העצמי והתשואה. ברירת מחדל: מחיר הרכישה.</p>
      <div className="form-2col">
        <div className="form-row">
          <label>תאריך חתימת חוזה</label>
          <DateField value={purchaseDate} onChange={setPurchaseDate} ariaLabel="תאריך רכישה" />
        </div>
        <div className="form-row">
          <label>תאריך מסירת מפתח</label>
          <DateField value={keyDeliveryDate} onChange={setKeyDeliveryDate} ariaLabel="מסירת מפתח" />
        </div>
      </div>
      <div className="form-row">
        <label>הערות</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <div className="form-error" role="alert">{err}</div>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
      </div>
    </form>
  )
}
