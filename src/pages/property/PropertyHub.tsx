import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { House, Bank, FileText, ShieldCheck, Coins, CaretDown } from '@phosphor-icons/react'
import Details from './Details'
import Mortgage from '../Mortgage'
import Rental from './Rental'
import Insurance from './Insurance'
import InvestmentCosts from './InvestmentCosts'

const SECTIONS = [
  { id: 'details', label: 'נכס', Icon: House, Comp: Details },
  { id: 'mortgage', label: 'משכנתא', Icon: Bank, Comp: Mortgage },
  { id: 'rental', label: 'שכירות', Icon: FileText, Comp: Rental },
  { id: 'insurance', label: 'ביטוח', Icon: ShieldCheck, Comp: Insurance },
  { id: 'costs', label: 'עלויות השקעה', Icon: Coins, Comp: InvestmentCosts },
] as const

// Legacy deep-link aliases → section ids (so old /property/* links don't 404)
const ALIASES: Record<string, string> = {
  overview: 'details',
  investment: 'costs',
}

function resolveSection(raw: string | undefined): string {
  if (!raw) return 'details'
  const id = ALIASES[raw] ?? raw
  return SECTIONS.some(s => s.id === id) ? id : 'details'
}

export default function PropertyHub() {
  const { section } = useParams()
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => resolveSection(section))

  // Keep the open panel in sync when navigated via a deep link / external nav
  useEffect(() => {
    if (section) setOpen(resolveSection(section))
  }, [section])

  function toggle(id: string) {
    if (open === id) {
      setOpen('')
      navigate('/property', { replace: true })
    } else {
      setOpen(id)
      navigate(`/property/${id}`, { replace: true })
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>הנכס</h1>
      </div>

      <div className="prop-accordion">
        {SECTIONS.map(({ id, label, Icon, Comp }) => {
          const isOpen = open === id
          return (
            <div key={id} className={`prop-accordion-item${isOpen ? ' open' : ''}`}>
              <button
                className="prop-accordion-header"
                onClick={() => toggle(id)}
                aria-expanded={isOpen}
              >
                <span className="prop-accordion-title">
                  <Icon size={20} weight="duotone" />
                  {label}
                </span>
                <CaretDown size={18} className="prop-accordion-chevron" />
              </button>
              {isOpen && (
                <div className="prop-accordion-panel">
                  <Comp />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
