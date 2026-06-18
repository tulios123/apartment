const VARIANTS = [
  { href: '/ux-sandbox/dual-mode', title: 'Dual Mode ★', desc: 'תפעול · השקעה — refined existing direction w/ full mode toggle' },
  { href: '/ux-sandbox/anz-fluid', title: 'ANZ Fluid', desc: 'Mobile app translation · sliding lens viewport' },
  { href: '/ux-sandbox/anz-clean', title: 'ANZ Clean', desc: 'Premium desktop web portal · bento + side drawer' },
  { href: '/ux-sandbox/anz-expressive', title: 'ANZ Expressive', desc: 'Micro-motion · dynamic color scales' },
  { href: '/ux-sandbox/anz-hybrid', title: 'ANZ Hybrid ✦', desc: 'Fluid + Clean fused · light web portal w/ sliding lens' },
]

export default function SandboxIndex() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0e1118', color: '#f4f6fa',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '2rem', padding: '2rem',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
        ANZ Plus — Sandbox Variants
      </h1>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {VARIANTS.map(v => (
          <a key={v.href} href={v.href} style={{
            display: 'block', width: 260, padding: '1.5rem',
            background: '#161b24', border: '1px solid #222a36',
            borderRadius: 16, textDecoration: 'none', color: 'inherit',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00d2c4' }}>{v.title}</div>
            <div style={{ fontSize: '0.85rem', color: '#8b94a3', marginTop: '0.5rem' }}>{v.desc}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
