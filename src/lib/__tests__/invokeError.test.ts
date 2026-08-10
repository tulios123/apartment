import { describe, it, expect } from 'vitest'
import { invokeErrorMessage } from '../invokeError'

// A FunctionsHttpError from supabase-js carries the raw Response on `.context`.
const withBody = (body: unknown) => ({ context: { json: async () => body } })

describe('invokeErrorMessage', () => {
  it('surfaces the server 4xx Hebrew message as-is', async () => {
    const err = withBody({ error: 'חרגתם ממכסת הסריקות היומית — נסו שוב מחר.' })
    expect(await invokeErrorMessage(err, 'לא הצלחנו')).toBe('חרגתם ממכסת הסריקות היומית — נסו שוב מחר.')
  })

  it('ignores a non-Hebrew server blob and uses the fallback', async () => {
    const err = withBody({ error: 'Internal server error' })
    expect(await invokeErrorMessage(err, 'לא הצלחנו לקרוא')).toBe('לא הצלחנו לקרוא')
  })

  it('falls back when there is no server body (offline → network hint)', async () => {
    const err = new TypeError('Failed to fetch')
    const msg = await invokeErrorMessage(err, 'לא הצלחנו לקרוא')
    expect(msg).toContain('חיבור')
  })

  it('uses the fallback when the body has no error field', async () => {
    expect(await invokeErrorMessage(withBody({ ok: true }), 'ברירת מחדל')).toBe('ברירת מחדל')
  })

  it('uses the fallback when reading the body throws', async () => {
    const err = { context: { json: async () => { throw new Error('already consumed') } } }
    expect(await invokeErrorMessage(err, 'ברירת מחדל')).toBe('ברירת מחדל')
  })
})
