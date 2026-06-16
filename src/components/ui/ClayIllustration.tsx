import './ui.css'

export type ClayVariant =
  | 'house'
  | 'check'
  | 'exchange'
  | 'bank'
  | 'folder'
  | 'cycle'
  | 'receipt'
  | 'shield'
  | 'document'

const CLAY_COLORS: Record<ClayVariant, [string, string]> = {
  house: ['#3a5a8c', '#0A1F44'],
  bank: ['#3a5a8c', '#0A1F44'],
  check: ['#5fd6ae', '#1FA871'],
  shield: ['#5fd6ae', '#1FA871'],
  exchange: ['#5b9ff0', '#2A7DE1'],
  cycle: ['#5b9ff0', '#2A7DE1'],
  folder: ['#f6a98f', '#F0654E'],
  receipt: ['#f6a98f', '#F0654E'],
  document: ['#f6a98f', '#F0654E'],
}

function ClayIcon({ variant }: { variant: ClayVariant }) {
  const stroke = '#fff'
  switch (variant) {
    case 'house':
      return (
        <>
          <path d="M30 50 48 34l18 16" stroke={stroke} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 48v16a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V48" stroke={stroke} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'check':
      return <path d="M34 47l10 10 18-20" stroke={stroke} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    case 'exchange':
      return (
        <>
          <path d="M32 38h24m0 0-7-7m7 7-7 7" stroke={stroke} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M64 54H40m0 0 7 7m-7-7 7-7" stroke={stroke} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'bank':
      return <path d="M30 58h36M34 58V44m8 14V44m8 14V44m8 14V44M28 44l20-12 20 12" stroke={stroke} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    case 'folder':
      return <path d="M30 40h12l4 5h20a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H30a2 2 0 0 1-2-2V42a2 2 0 0 1 2-2Z" stroke={stroke} strokeWidth="4" fill="none" strokeLinejoin="round" />
    case 'cycle':
      return (
        <>
          <path d="M34 40a14 14 0 0 1 23-6m5 12a14 14 0 0 1-23 6" stroke={stroke} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M57 32l5 2-2 6M39 60l-5-2 2-6" stroke={stroke} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'receipt':
      return (
        <>
          <path d="M36 30h24v36l-4-3-4 3-4-3-4 3-4-3-4 3V30Z" stroke={stroke} strokeWidth="4" fill="none" strokeLinejoin="round" />
          <path d="M41 40h14M41 48h14" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        </>
      )
    case 'shield':
      return (
        <>
          <path d="M48 30l16 6v12c0 12-7 18-16 22-9-4-16-10-16-22V36l16-6Z" stroke={stroke} strokeWidth="4" fill="none" strokeLinejoin="round" />
          <path d="M41 47l6 6 9-11" stroke={stroke} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'document':
      return (
        <>
          <rect x="36" y="30" width="24" height="32" rx="3" stroke={stroke} strokeWidth="4" fill="none" />
          <path d="M42 40h12M42 48h12M42 56h8" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        </>
      )
  }
}

export function ClayIllustration({ variant, size = 88 }: { variant: ClayVariant; size?: number }) {
  const gradientId = `clay-grad-${variant}`
  const [c1, c2] = CLAY_COLORS[variant]
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="20" y1="14" x2="76" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="82" rx="24" ry="5" fill="#0E1F2A" opacity="0.08" />
      <circle cx="48" cy="46" r="38" fill={`url(#${gradientId})`} />
      <ellipse cx="33" cy="29" rx="15" ry="9" fill="#fff" opacity="0.22" />
      <ClayIcon variant={variant} />
    </svg>
  )
}
