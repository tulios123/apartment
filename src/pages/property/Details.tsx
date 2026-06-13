import { House, X } from '@phosphor-icons/react'
import { useState } from 'react'
import {
  usePropertyData,
  createProperty,
  updateProperty,
} from '../../hooks/usePropertyData'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate, formatCurrency } from '../../lib/format'
import type { Property } from '../../types'
import { SkeletonList } from '../../components/ui/Skeleton'

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
  return raw === '' || isNaN(n) ? raw : n.toLocaleString('en-US')
}

function PropertyForm({
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
          <input type="text" value={city} onChange={e => setCity(e.target.value)} required placeholder="עיר" />
        </div>
      </div>
      <div className="form-2col">
        <div className="form-row">
          <label>גוש</label>
          <input type="text" value={block} onChange={e => setBlock(e.target.value)} placeholder="גוש" />
        </div>
        <div className="form-row">
          <label>חלקה</label>
          <input type="text" value={parcel} onChange={e => setParcel(e.target.value)} placeholder="חלקה" />
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

      {err && <div className="form-error">{err}</div>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
      </div>
    </form>
  )
}

export default function Details() {
  const { user } = useAuth()
  const { property, loading, error, refetch } = usePropertyData()
  const [showModal, setShowModal] = useState(false)

  async function handleSave(data: PropertyFields) {
    if (!user) return
    if (property) {
      await updateProperty(property.id, data)
    } else {
      await createProperty({ owner_id: user.id, address: data.address ?? '', notes: data.notes ?? null, ...data })
    }
    setShowModal(false)
    refetch()
  }

  if (loading) return <SkeletonList rows={5} />
  if (error) return <div className="form-error">{error}</div>

  return (
    <>
      <section className="prop-section">
        <div className="prop-section-header">
          <h2>פרטי הנכס</h2>
          <button className="btn-secondary" onClick={() => setShowModal(true)}>
            {property ? 'עריכה' : '+ הוסף נכס'}
          </button>
        </div>
        {property ? (
          <div className="prop-card">
            <div className="prop-field-row">
              <span className="prop-field-label">כתובת</span>
              <span>{property.address}</span>
            </div>
            {property.block_parcel && (
              <div className="prop-field-row">
                <span className="prop-field-label">גוש / חלקה</span>
                <span>{property.block_parcel}</span>
              </div>
            )}
            {(property.floor != null || property.rooms != null || property.property_size_sqm != null) && (
              <div className="prop-field-row">
                <span className="prop-field-label">פרטים</span>
                <span>
                  {[
                    property.floor != null && `קומה ${property.floor}`,
                    property.rooms != null && `${property.rooms} חדרים`,
                    property.property_size_sqm != null && `${property.property_size_sqm} מ"ר`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
            {property.buyer_name && (
              <div className="prop-field-row">
                <span className="prop-field-label">קונה</span>
                <span>{property.buyer_name}</span>
              </div>
            )}
            {property.purchase_price != null && (
              <div className="prop-field-row">
                <span className="prop-field-label">מחיר רכישה</span>
                <span>{formatCurrency(property.purchase_price)}</span>
              </div>
            )}
            {property.purchase_date && (
              <div className="prop-field-row">
                <span className="prop-field-label">חתימת חוזה</span>
                <span>{formatDate(property.purchase_date)}</span>
              </div>
            )}
            {property.key_delivery_date && (
              <div className="prop-field-row">
                <span className="prop-field-label">מסירת מפתח</span>
                <span>{formatDate(property.key_delivery_date)}</span>
              </div>
            )}
            {property.notes && (
              <div className="prop-field-row">
                <span className="prop-field-label">הערות</span>
                <span>{property.notes}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state-cta">
            <div className="empty-state-cta-icon"><House size={40} /></div>
            <p>עדיין לא הוזנו פרטי הנכס</p>
            <button className="btn-primary" onClick={() => setShowModal(true)}>+ הוסף נכס</button>
          </div>
        )}
      </section>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{property ? 'עריכת נכס' : 'נכס חדש'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)} aria-label="סגור" title="סגור"><X size={18} /></button>
            </div>
            <PropertyForm
              initial={property ?? {}}
              onSave={handleSave}
              onCancel={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
