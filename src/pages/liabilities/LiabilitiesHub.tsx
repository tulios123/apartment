import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bank, HandCoins, CaretDown } from '@phosphor-icons/react'
import Mortgage from '../Mortgage'
import Loans from './Loans'

const SECTIONS = [
  { id: 'mortgage', label: 'משכנתא', Icon: Bank, Comp: Mortgage },
  { id: 'loans', label: 'הלוואות', Icon: HandCoins, Comp: Loans },
] as const

function resolveSection(raw: string | undefined): string {
  if (!raw) return 'mortgage'
  return SECTIONS.some(s => s.id === raw) ? raw : 'mortgage'
}

export default function LiabilitiesHub() {
  const { section } = useParams()
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => resolveSection(section))

  useEffect(() => {
    if (section) setOpen(resolveSection(section))
  }, [section])

  function toggle(id: string) {
    if (open === id) {
      setOpen('')
      navigate('/liabilities', { replace: true })
    } else {
      setOpen(id)
      navigate(`/liabilities/${id}`, { replace: true })
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>התחייבויות</h1>
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
