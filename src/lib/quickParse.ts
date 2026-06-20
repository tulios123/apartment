// Shared light natural-language helpers for the Home quick-capture.

export type ParsedQuick = { amount: number; desc: string; income: boolean }

// "שילמתי 350 ₪ על תיקון ברז" → { amount:350, desc:"תיקון ברז", income:false }
export function parseQuick(raw: string): ParsedQuick | null {
  const text = raw.trim()
  if (!text) return null
  const numMatch = text.replace(/,/g, '').match(/\d+(\.\d+)?/)
  if (!numMatch) return null
  const amount = Number(numMatch[0])
  if (!amount) return null
  const income = /קיבלתי|התקבל|הכנס|נכנס/.test(text)
  const desc = text
    .replace(/\d+(\.\d+)?/, '')
    .replace(/₪/g, '')
    .replace(/(^|\s)ש["']?ח(?=\s|$)/g, ' ') // shekel abbreviation as a standalone token, not the letters ש/ח inside words
    .replace(/^\s*(שילמתי|קיבלתי|הוצאתי|עבור|על|בעבור)\s*/g, '')
    .replace(/\s+(עבור|על)\s+/g, ' ')
    .trim()
  return { amount, desc: desc || 'אחר', income }
}

// Keyword → expense category. Falls back to 'אחר'.
export function predictCategory(text: string): string {
  const t = text.trim()
  if (/תיקון|ברז|אינסטל|חשמלאי|נזילה|תחזוק|צבע|מזגן|דוד/.test(t)) return 'תיקונים'
  if (/ריבית|עמלה|בנק/.test(t)) return 'ריבית'
  return 'אחר'
}
