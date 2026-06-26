// Shared light natural-language helpers for the Home quick-capture.

export type ParsedQuick = { amount: number; desc: string; income: boolean }

// EDGE-19: dropped the ambiguous הפקד / החזר / זיכוי tokens — "הפקדתי 500 בבנק"
// (moving money) was wrongly classified as income. Only unambiguous income phrasings
// remain; the quick-capture defaults to expense otherwise.
const INCOME_RE = /קיבלתי|התקבל|הכנס|נכנס|שכר[\s-]?דירה|שכ["']?ד|שכירות|משכורת|תשלום\s+מהשוכר|שוכר\s+שילם/
// ₪ and "nis" are safe to strip anywhere. The Hebrew currency words (ש"ח, שקל)
// must only match as standalone tokens — bounded by non-Hebrew on both sides —
// or they mangle ordinary words that merely contain them (שחור→"ור", משחק→"מק").
const SHEKEL_RE = /₪|\bnis\b/gi
const SHEKEL_WORD_RE = /(^|[^א-ת])(ש["']?ח|שקל(?:ים)?)(?=[^א-ת]|$)/g
// Leading verbs / fillers that aren't part of the description.
const LEAD_RE = /^\s*(שילמתי|שילמת|שולם|קיבלתי|התקבל|הוצאתי|הוצאה|הכנסה|רשום|תרשום|תוסיף|הוסף)\s*/g
// Connector words between amount and subject. Also matches a connector left at
// the start once the lead verb is stripped ("שילמתי 350 על תיקון" → "תיקון").
const CONNECTOR_RE = /(^|\s)(עבור|על|בעבור|בגין|ל|של|מ)\s+/g
// Time words that add noise to the description.
const TIME_RE = /(^|\s)(היום|אתמול|מחר|השבוע|החודש)(?=\s|$)/g

// "שילמתי 350 ₪ על תיקון ברז" → { amount:350, desc:"תיקון ברז", income:false }
export function parseQuick(raw: string): ParsedQuick | null {
  const text = raw.trim()
  if (!text) return null

  // First number, allowing thousands separators (1,250) and decimals (12.5).
  const numMatch = text.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(\.\d+)?/)
  if (!numMatch) return null
  const amount = Number(numMatch[0])
  if (!amount) return null

  const income = INCOME_RE.test(text)

  const desc = text
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/\d+(\.\d+)?/, ' ')
    .replace(SHEKEL_RE, ' ')
    .replace(SHEKEL_WORD_RE, '$1 ')
    .replace(LEAD_RE, '')
    .replace(TIME_RE, ' ')
    .replace(CONNECTOR_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    // First sentence only — multi-sentence input (e.g. "…350 על ברז. הרגיל הוא 500.")
    // must not drag a later sentence (and its number) into the description. The
    // amount is already the FIRST number in the text, so this just trims the noise.
    .split(/[.\n]+/)[0]
    .trim()

  return { amount, desc: desc || 'אחר', income }
}

// Keyword → expense category. Output is limited to the one-time expense set
// (תיקונים / ריבית / אחר); the keyword net is wide so common phrasings land right.
export function predictCategory(text: string): string {
  const t = text.trim()
  if (/תיקון|ברז|אינסטל|חשמלאי|נזיל|תחזוק|צבע|מזגן|דוד|נגר|מנעול|דלת|חלון|אסל|ביוב|סתימ|טכנאי|בוילר|תריס/.test(t)) return 'תיקונים'
  if (/ריבית|עמלה|בנק|משכנת|הלוואה/.test(t)) return 'ריבית'
  return 'אחר'
}
