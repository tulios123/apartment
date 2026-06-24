import { useState } from 'react'
import type { Property } from '../../types'

type PropertyFields = Partial<Omit<Property, 'id' | 'owner_id' | 'created_at'>>

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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!street.trim() || !city.trim()) return
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
      setErr(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <div className="form-section-label">פרטי הנכס</div>
      <div className="form-2col">
        <div className="form-row">
          <label>רחוב</label>
          <input type="text" value={street} onChange={e => setStreet(e.target.value)} required autoFocus placeholder="רחוב ומספר" />
        </div>
        <div className="form-row">
          <label>עיר</label>
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
            onChange={e => setPurchasePrice(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="0"
          />
        </div>
        <div className="form-row">
          <label>שווי נכס נוכחי (₪)</label>
          <input
            type="text"
            inputMode="numeric"
            value={estimatedValue ? formatPrice(estimatedValue) : ''}
            onChange={e => setEstimatedValue(e.target.value.replace(/[^\d]/g, ''))}
            placeholder={purchasePrice ? formatPrice(purchasePrice) : '0'}
          />
        </div>
      </div>
      <p className="form-hint">שווי השוק העדכני — משמש לחישוב ההון העצמי והתשואה. ברירת מחדל: מחיר הרכישה.</p>
      <div className="form-2col">
        <div className="form-row">
          <label>תאריך חתימת חוזה</label>
          <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </div>
        <div className="form-row">
          <label>תאריך מסירת מפתח</label>
          <input type="date" value={keyDeliveryDate} onChange={e => setKeyDeliveryDate(e.target.value)} />
        </div>
      </div>

      <div className="form-section-label">הערות</div>
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
