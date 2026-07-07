import type { ReactNode } from 'react'
import { Export, Plus, DeviceMobile, DotsThreeVertical } from '@phosphor-icons/react'
import { isIOS, isInstalledPWA } from '../lib/push'

// A short, platform-aware "install to the home screen" guide for family members.
// On iOS this is not optional — web push only reaches an installed PWA — so the
// copy says so. Hidden once the app is already running as an installed PWA.
export function InstallGuide() {
  if (isInstalledPWA()) return null

  const ios = isIOS()
  const steps: ReactNode[] = ios
    ? [
        <>פתחו את האתר בדפדפן <b>Safari</b> (לא בכרום או באפליקציה אחרת).</>,
        <>הקישו על כפתור <b>שיתוף</b> <Export size={15} weight="bold" /> שבתחתית המסך.</>,
        <>גללו ובחרו <b>הוסף למסך הבית</b> <Plus size={15} weight="bold" />, ואשרו.</>,
        <>פתחו את האפליקציה דרך הסמל החדש ב<b>מסך הבית</b> — ומשם אפשר להפעיל התראות.</>,
      ]
    : [
        <>פתחו את תפריט הדפדפן <DotsThreeVertical size={15} weight="bold" />.</>,
        <>בחרו <b>התקנת אפליקציה</b> או <b>הוספה למסך הבית</b>.</>,
        <>פתחו את האפליקציה מהסמל החדש והפעילו התראות מכאן, בהגדרות.</>,
      ]

  return (
    <section className="settings-section">
      <h2><DeviceMobile size={18} weight="duotone" style={{ verticalAlign: '-3px', marginInlineEnd: 6 }} />התקנה על הטלפון</h2>
      <p className="settings-note">
        התקינו את "ניהול דירה" כאפליקציה — כך תפתחו אותה במהירות מהמסך הראשי ותקבלו תזכורות.
        {ios && ' ב-iPhone חובה להתקין כדי שההתראות יעבדו בכלל.'}
      </p>
      <ol className="install-steps">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </section>
  )
}
