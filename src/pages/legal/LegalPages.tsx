import { useNavigate } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import { Markdown } from './Markdown'
import privacy from './privacy.md?raw'
import terms from './terms.md?raw'
import accessibility from './accessibility.md?raw'
import './legal.css'

// Shared frame for a legal page: a back chevron (top-right, RTL) + the rendered
// content in a readable centred column. Used both inside the app shell (authed
// routes) and standalone/public (see App.tsx) — hence the history-aware back.
function LegalShell({ source }: { source: string }) {
  const navigate = useNavigate()
  const back = () => { if (window.history.length > 1) navigate(-1); else navigate('/') }
  return (
    <div className="legal-page">
      <button className="legal-back" onClick={back} aria-label="חזרה">
        <ArrowRight size={22} />
      </button>
      <article className="legal-content">
        <Markdown source={source} />
      </article>
    </div>
  )
}

export function PrivacyPolicy() { return <LegalShell source={privacy} /> }
export function TermsOfService() { return <LegalShell source={terms} /> }
export function Accessibility() { return <LegalShell source={accessibility} /> }
