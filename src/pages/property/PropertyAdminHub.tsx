import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, ShieldCheck, CheckSquare, FolderOpen, UserCircle, PencilSimple } from '@phosphor-icons/react'
import { PropertyForm } from './PropertyForm'
import { Modal } from '../../components/ui/Modal'
import Rental from './Rental'
import Insurance from './Insurance'
import TasksV2 from '../tasks/TasksV2'
import DocumentsV2 from '../documents/DocumentsV2'
import { usePropertyData, createProperty, updateProperty } from '../../hooks/usePropertyData'
import { useAuth } from '../../contexts/AuthContext'
import { activeContract as findActiveContract } from '../../lib/projections'
import { formatCurrency, formatDate } from '../../lib/format'
import type { Property } from '../../types'
import { SkeletonList } from '../../components/ui/Skeleton'
import './property-v2.css'

const TasksPanel = () => <TasksV2 embedded />
const DocumentsPanel = () => <DocumentsV2 embedded />

const TABS = [
  { id: 'rental', label: 'חוזה', Icon: FileText, Comp: Rental },
  { id: 'insurance', label: 'ביטוח', Icon: ShieldCheck, Comp: Insurance },
  { id: 'tasks', label: 'משימות', Icon: CheckSquare, Comp: TasksPanel },
  { id: 'documents', label: 'מסמכים', Icon: FolderOpen, Comp: DocumentsPanel },
] as const

// Property details now live in the top binder (not a tab); legacy deep-links fall back to the contract.
const ALIASES: Record<string, string> = { details: 'rental', overview: 'rental', costs: 'rental', investment: 'rental' }

function resolveSection(raw: string | undefined): string {
  if (!raw) return 'rental'
  const id = ALIASES[raw] ?? raw
  return TABS.some(t => t.id === id) ? id : 'rental'
}

const fmt = (v: number) => formatCurrency(v)

export default function PropertyAdminHub() {
  const { section } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState(() => resolveSection(section))

  const { property, contracts, loading, refetch } = usePropertyData()
  const [showModal, setShowModal] = useState(false)

  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0
  const activeTenant = findActiveContract(contracts)?.company_name ?? null

  const subParts = property ? [
    property.rooms != null ? `${property.rooms} חד׳` : null,
    property.floor != null ? `קומה ${property.floor}` : null,
    property.property_size_sqm != null ? `${property.property_size_sqm} מ״ר` : null,
  ].filter(Boolean) : []

  // Complementary details (block/parcel, key delivery, notes). Purchase price now
  // sits under the address as the headline value, so it's dropped from here.
  const extraParts = property ? [
    property.block_parcel || null,
    property.purchase_date ? `חתימה: ${formatDate(property.purchase_date)}` : null,
    property.key_delivery_date ? `מסירה: ${formatDate(property.key_delivery_date)}` : null,
  ].filter(Boolean) : []

  useEffect(() => {
    if (section) setTab(resolveSection(section))
  }, [section])

  function selectTab(id: string) {
    setTab(id)
    navigate(`/property/${id}`, { replace: true })
  }

  async function handleSave(data: Partial<Omit<Property, 'id' | 'owner_id' | 'created_at'>>) {
    if (!user) return
    if (property) await updateProperty(property.id, data)
    else await createProperty({ owner_id: user.id, address: data.address ?? '', notes: data.notes ?? null, ...data })
    setShowModal(false)
    refetch()
  }

  const Active = TABS.find(t => t.id === tab)?.Comp ?? Rental

  return (
    <div className="page prov">
      <div className="page-header"><h1>ניהול הנכס</h1></div>

      {loading ? <SkeletonList rows={2} /> : (
        <>
          {/* Property binder — summary at the top, edit in place */}
          <div className="padm-binder">
            <div className="padm-binder-top">
              <div className="padm-binder-main">
                <div className="padm-binder-addr">{property?.address ?? 'עדיין לא הוגדר נכס'}</div>
                {propertyValue > 0 && <div className="padm-binder-value">{fmt(propertyValue)}</div>}
                {subParts.length > 0 && <div className="padm-binder-sub">{subParts.join(' · ')}</div>}
              </div>
              <div className="padm-binder-side">
                {activeTenant && (
                  <div className="padm-binder-tenant"><UserCircle size={15} weight="duotone" /> {activeTenant} · חוזה פעיל</div>
                )}
                <button className="padm-binder-edit" onClick={() => setShowModal(true)}>
                  <PencilSimple size={14} /> {property ? 'עריכה' : 'הוסף נכס'}
                </button>
              </div>
            </div>
            {(extraParts.length > 0 || property?.notes) && (
              <div className="padm-binder-foot">
                {extraParts.length > 0 && <span className="padm-binder-extra">{extraParts.join(' · ')}</span>}
                {property?.notes && <span className="padm-binder-notes">{property.notes}</span>}
              </div>
            )}
          </div>

          <nav className="prov-tabs">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`prov-tab${tab === id ? ' on' : ''}`}
                onClick={() => selectTab(id)}
              >
                <Icon size={18} weight={tab === id ? 'fill' : 'regular'} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="prov-panel">
            <Active />
          </div>
        </>
      )}

      {showModal && (
        <Modal title={property ? 'עריכת נכס' : 'נכס חדש'} onClose={() => setShowModal(false)}>
          <PropertyForm initial={property ?? {}} onSave={handleSave} onCancel={() => setShowModal(false)} />
        </Modal>
      )}
    </div>
  )
}
