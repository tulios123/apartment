import { useState } from 'react'
import {
  usePropertyData,
  createProperty,
  updateProperty,
  createContract,
  updateContract,
  deleteContract,
  upsertUtilities,
} from '../hooks/usePropertyData'
import { useAuth } from '../contexts/AuthContext'
import { UTILITIES } from '../lib/constants'
import { formatDate, formatCurrency } from '../lib/format'
import type { Property, Contract, UtilityPayer } from '../types'

// ─── Property form ─────────────────────────────────────────────────────────

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

// ─── Contract form ──────────────────────────────────────────────────────────

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
        <input type="text" inputMode="numeric" value={form.monthly_rent ? Number(form.monthly_rent).toLocaleString('en-US') : ''} onChange={e => set('monthly_rent', e.target.value.replace(/[^\d]/g, ''))} required />
      </div>
      <div className="form-row">
        <label>פיקדון</label>
        <input type="text" inputMode="numeric" value={form.deposit ? Number(form.deposit).toLocaleString('en-US') : ''} onChange={e => set('deposit', e.target.value.replace(/[^\d]/g, ''))} />
      </div>
      {err && <div className="form-error">{err}</div>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
      </div>
    </form>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function PropertyPage() {
  const { user } = useAuth()
  const { property, contracts, utilities, loading, error, refetch } = usePropertyData()

  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)

  // Utility payer state per contract (local, saved on toggle)
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

  // ── Property handlers ──
  async function handlePropertySave(data: PropertyFields) {
    if (!user) return
    if (property) {
      await updateProperty(property.id, data)
    } else {
      await createProperty({ owner_id: user.id, address: data.address ?? '', notes: data.notes ?? null, ...data })
    }
    setShowPropertyModal(false)
    refetch()
  }

  // ── Contract handlers ──
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
      // seed utilities: all tenant by default
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

  return (
    <div className="page property-page">
      <div className="page-header">
        <h1>נכס</h1>
      </div>

      {/* ── Property section ── */}
      <section className="prop-section">
        <div className="prop-section-header">
          <h2>פרטי הנכס</h2>
          <button className="btn-secondary" onClick={() => setShowPropertyModal(true)}>
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
          <div className="empty-state small">טרם הוזן נכס</div>
        )}
      </section>

      {/* ── Contracts section ── */}
      {property && (
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

                {/* Utilities */}
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
      )}

      {/* ── Property modal ── */}
      {showPropertyModal && (
        <div className="modal-overlay" onClick={() => setShowPropertyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{property ? 'עריכת נכס' : 'נכס חדש'}</h2>
              <button className="btn-icon" onClick={() => setShowPropertyModal(false)}>✕</button>
            </div>
            <PropertyForm
              initial={property ?? {}}
              onSave={data => handlePropertySave(data)}
              onCancel={() => setShowPropertyModal(false)}
            />
          </div>
        </div>
      )}

      {/* ── Contract modal ── */}
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
    </div>
  )
}
