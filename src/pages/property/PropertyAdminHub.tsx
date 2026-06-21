import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, ShieldCheck, CheckSquare, FolderOpen } from '@phosphor-icons/react'
import Details from './Details'
import Rental from './Rental'
import Insurance from './Insurance'
import TasksV2 from '../tasks/TasksV2'
import DocumentsV2 from '../documents/DocumentsV2'
import './property-v2.css'

const TasksPanel = () => <TasksV2 embedded />
const DocumentsPanel = () => <DocumentsV2 embedded />

const TABS = [
  { id: 'rental', label: 'חוזה', Icon: FileText, Comp: Rental },
  { id: 'insurance', label: 'ביטוח', Icon: ShieldCheck, Comp: Insurance },
  { id: 'tasks', label: 'משימות', Icon: CheckSquare, Comp: TasksPanel },
  { id: 'documents', label: 'מסמכים', Icon: FolderOpen, Comp: DocumentsPanel },
] as const

// Property details now live at the top (not a tab); legacy deep-links fall back to the contract.
const ALIASES: Record<string, string> = { details: 'rental', overview: 'rental', costs: 'rental', investment: 'rental' }

function resolveSection(raw: string | undefined): string {
  if (!raw) return 'rental'
  const id = ALIASES[raw] ?? raw
  return TABS.some(t => t.id === id) ? id : 'rental'
}

export default function PropertyAdminHub() {
  const { section } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => resolveSection(section))

  useEffect(() => {
    if (section) setTab(resolveSection(section))
  }, [section])

  function selectTab(id: string) {
    setTab(id)
    navigate(`/property/${id}`, { replace: true })
  }

  const Active = TABS.find(t => t.id === tab)?.Comp ?? Rental

  return (
    <div className="page prov">
      <div className="page-header"><h1>ניהול הנכס</h1></div>

      {/* Property details — always at the top */}
      <Details />

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
    </div>
  )
}
