// Human-readable name for the screen a feedback note (or dev note) was written on.
// Kept in one place so the in-app note button, the onboarding note button, and the
// admin's feedback reader in Settings all describe screens identically.
//
// `path` is whatever was captured at write time: for routed screens it's the real
// pathname (e.g. "/property/insurance"); for the onboarding wizard — which lives at
// a single route — it's a synthetic "/onboarding/<step>" so each step is distinct.

const ONBOARDING_STEPS: Record<string, string> = {
  welcome: 'ברוכים הבאים',
  documents: 'מסמכים',
  purchase: 'פרטי רכישה',
  mortgage: 'משכנתא',
  loans: 'הלוואות',
  investment: 'הון עצמי והשקעה',
  rental: 'שכירות',
  insurance: 'ביטוח',
  done: 'סיום',
}

const PROPERTY_SECTIONS: Record<string, string> = {
  rental: 'חוזה שכירות',
  insurance: 'ביטוח',
  tasks: 'משימות',
  documents: 'מסמכים',
}

export function screenLabel(path: string | null | undefined): string {
  if (!path) return 'לא ידוע'
  // Strip any query/hash so matching is on the clean route.
  const p = path.split('?')[0].split('#')[0]

  if (p === '/login') return 'התחברות'

  if (p.startsWith('/onboarding')) {
    const step = p.slice('/onboarding/'.length)
    return step && ONBOARDING_STEPS[step] ? `הרשמה · ${ONBOARDING_STEPS[step]}` : 'הרשמה'
  }

  if (p === '/' || p === '') return 'מסך הבית'

  if (p.startsWith('/finances')) return 'תזרים'

  if (p.startsWith('/wealth')) {
    return p.startsWith('/wealth/liabilities') ? 'הון · התחייבויות' : 'הון'
  }

  if (p.startsWith('/property')) {
    const section = p.split('/')[2]
    return section && PROPERTY_SECTIONS[section]
      ? `ניהול · ${PROPERTY_SECTIONS[section]}`
      : 'ניהול הנכס'
  }

  if (p.startsWith('/settings')) return 'הגדרות'

  return p
}
