import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { House, FileText, ShieldCheck, ListChecks, FolderOpen } from '@phosphor-icons/react'
import Details from './Details'
import Rental from './Rental'
import Insurance from './Insurance'
import TasksV2 from '../tasks/TasksV2'
import DocumentsV2 from '../documents/DocumentsV2'
import { usePropertyData } from '../../hooks/usePropertyData'
import { formatCurrency } from '../../lib/format'
import { SkeletonList } from '../../components/ui/Skeleton'
import './property-v2.css'

const TasksPanel = () => <TasksV2 embedded />
const DocumentsPanel = () => <DocumentsV2 embedded />

const TABS = [
  { id: 'details', label: 'נכס', Icon: House, Comp: Details },
  { id: 'rental', label: 'חוזים', Icon: FileText, Comp: Rental },
  { id: 'insurance', label: 'ביטוח', Icon: ShieldCheck, Comp: Insurance },
  { id: 'tasks', label: 'משימות', Icon: ListChecks, Comp: TasksPanel },
  { id: 'documents', label: 'מסמכים', Icon: FolderOpen, Comp: DocumentsPanel },
] as const

// Legacy deep-link aliases → tab ids (investment/costs moved to the Wealth pillar)
const ALIASES: Record<string, string> = { overview: 'details', costs: 'details', investment: 'details' }

function resolveSection(raw: string | undefined): string {
  if (!raw) return 'details'
  const id = ALIASES[raw] ?? raw
  return TABS.some(t => t.id === id) ? id : 'details'
}

const fmt = (v: number) => formatCurrency(v)

export default function PropertyAdminHub() {
  const { section } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => resolveSection(section))

  const { property, loading } = usePropertyData()
  const propertyValue = property?.estimated_value ?? property?.purchase_price ?? 0

  useEffect(() => {
    if (section) setTab(resolveSection(section))
  }, [section])

  function selectTab(id: string) {
    setTab(id)
    navigate(`/property/${id}`, { replace: true })
  }

  const Active = TABS.find(t => t.id === tab)?.Comp ?? Details

  return (
    <div className="page prov">
      <div className="page-header"><h1>ניהול הנכס</h1></div>

      {loading ? <SkeletonList rows={2} /> : (
        <>
          {property?.address && (
            <div className="prov-ident">
              <div className="prov-ident-addr">{property.address}</div>
              {propertyValue > 0 && <div className="prov-ident-value">{fmt(propertyValue)}</div>}
            </div>
          )}

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
    </div>
  )
}
