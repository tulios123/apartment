import { describe, it, expect } from 'vitest'
import { parseQuick, predictCategory } from '../quickParse'

describe('parseQuick — amount + description', () => {
  it('parses a typical expense', () => {
    expect(parseQuick('שילמתי 350 ₪ על תיקון ברז')).toEqual({ amount: 350, desc: 'תיקון ברז', income: false })
  })
  it('strips the leading connector after the verb', () => {
    // "שילמתי 350 על תיקון" — the connector "על" must not survive into the description.
    expect(parseQuick('שילמתי 350 על תיקון')?.desc).toBe('תיקון')
  })
  it('parses thousands separators and decimals', () => {
    expect(parseQuick('הכנסה 1,250 שכירות')?.amount).toBe(1250)
    expect(parseQuick('12.5 דלק')?.amount).toBe(12.5)
  })
  it('falls back to "אחר" when no description remains', () => {
    expect(parseQuick('שילמתי 350 ₪')?.desc).toBe('אחר')
  })
  it('multi-sentence: takes the FIRST amount and only the first sentence as description', () => {
    const r = parseQuick('שילמתי 350 שח על אינסטלטור. הוא אמר שהמחיר הרגיל הוא 500.')
    expect(r?.amount).toBe(350)          // first number, not the 500 in sentence 2
    expect(r?.desc).toBe('אינסטלטור')
    expect(r?.desc).not.toContain('500')
  })
})

describe('parseQuick — currency words', () => {
  it('strips a standalone "שח" / "שקל"', () => {
    expect(parseQuick('שילמתי 350 שח על ארנונה')?.desc).toBe('ארנונה')
    expect(parseQuick('תיקון 200 שקל')?.desc).toContain('תיקון')
  })
  it('does NOT mangle a word that merely contains שח (משחק, שחור)', () => {
    expect(parseQuick('שילמתי 200 על משחק')?.desc).toBe('משחק')
    expect(parseQuick('100 צבע שחור')?.desc).toContain('שחור')
  })
})

describe('parseQuick — income detection', () => {
  it('detects income verbs/nouns', () => {
    expect(parseQuick('קיבלתי 5000 שכר דירה')?.income).toBe(true)
    expect(parseQuick('הופקד 6200 שכירות')?.income).toBe(true)
    expect(parseQuick('החזר 300 ארנונה')?.income).toBe(true)
  })
  it('treats plain payments as expense', () => {
    expect(parseQuick('שילמתי 350 על תיקון')?.income).toBe(false)
    expect(parseQuick('200 דלק')?.income).toBe(false)
  })
})

describe('parseQuick — guards', () => {
  it('returns null without a (non-zero) amount', () => {
    expect(parseQuick('טקסט בלי מספר')).toBeNull()
    expect(parseQuick('')).toBeNull()
    expect(parseQuick('   ')).toBeNull()
    expect(parseQuick('0 על כלום')).toBeNull()
  })
})

describe('predictCategory', () => {
  it('maps repair keywords to תיקונים', () => {
    expect(predictCategory('תיקון ברז')).toBe('תיקונים')
    expect(predictCategory('החלפת מזגן')).toBe('תיקונים')
  })
  it('maps finance keywords to ריבית', () => {
    expect(predictCategory('ריבית משכנתא')).toBe('ריבית')
    expect(predictCategory('עמלה בנק')).toBe('ריבית')
  })
  it('defaults to אחר', () => {
    expect(predictCategory('קניות בסופר')).toBe('אחר')
  })
})
