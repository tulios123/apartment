import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { monthlyPayment, combineSchedules, interestToDate, trackSchedule } from '../lib/mortgage'
import type { Mortgage, MortgageTrack, TrackType } from '../types'
import type { ScheduleRow } from '../lib/mortgage'

export interface MortgageSummary {
  totalPrincipal: number
  currentBalance: number
  monthlyPayment: number
  totalInterestLife: number
  interestPaidToDate: number
}

export interface MortgageData {
  mortgage: Mortgage | null
  tracks: MortgageTrack[]
  combined: ScheduleRow[]
  summary: MortgageSummary
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useMortgageData(): MortgageData {
  const { user } = useAuth()
  const [mortgage, setMortgage] = useState<Mortgage | null>(null)
  const [tracks, setTracks] = useState<MortgageTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [mortgageRes, tracksRes] = await Promise.all([
        supabase.from('mortgages').select('*').eq('owner_id', user.id).limit(1),
        supabase.from('mortgage_tracks').select('*').eq('owner_id', user.id).order('created_at'),
      ])
      if (mortgageRes.error) throw mortgageRes.error
      if (tracksRes.error) throw tracksRes.error
      setMortgage(mortgageRes.data?.[0] ?? null)
      setTracks((tracksRes.data ?? []) as MortgageTrack[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const combined = combineSchedules(tracks)
  const today = new Date().toISOString().slice(0, 10)
  const lastPaidRow = [...combined].reverse().find(r => r.date <= today)

  const summary: MortgageSummary = {
    totalPrincipal: tracks.reduce((s, t) => s + t.principal, 0),
    currentBalance: lastPaidRow ? lastPaidRow.balance : tracks.reduce((s, t) => s + t.principal, 0),
    monthlyPayment: tracks.reduce((s, t) => s + monthlyPayment(t.principal, t.annual_rate, t.term_months, t.grace_months ?? 0), 0),
    totalInterestLife: tracks.flatMap(trackSchedule).reduce((s, r) => s + r.interest, 0),
    interestPaidToDate: interestToDate(tracks),
  }

  return { mortgage, tracks, combined, summary, loading, error, refetch: fetch }
}

export async function ensureMortgage(ownerId: string, propertyId?: string | null): Promise<Mortgage> {
  const { data: existing } = await supabase
    .from('mortgages').select('*').eq('owner_id', ownerId).limit(1)
  if (existing && existing.length > 0) return existing[0] as Mortgage
  const { data: row, error } = await supabase
    .from('mortgages')
    .insert({ owner_id: ownerId, property_id: propertyId ?? null })
    .select().single()
  if (error) throw error
  return row as Mortgage
}

export async function upsertMortgageTrack(data: {
  id?: string
  mortgage_id: string
  owner_id: string
  label: string | null
  track_type: TrackType
  principal: number
  annual_rate: number
  prime_rate?: number | null
  margin?: number | null
  term_months: number
  grace_months: number
  start_date: string
}): Promise<MortgageTrack> {
  if (data.id) {
    const { data: row, error } = await supabase
      .from('mortgage_tracks')
      .update({
        label: data.label,
        track_type: data.track_type,
        principal: data.principal,
        annual_rate: data.annual_rate,
        prime_rate: data.prime_rate ?? null,
        margin: data.margin ?? null,
        term_months: data.term_months,
        grace_months: data.grace_months,
        start_date: data.start_date,
      })
      .eq('id', data.id)
      .select().single()
    if (error) throw error
    return row as MortgageTrack
  } else {
    const { data: row, error } = await supabase
      .from('mortgage_tracks')
      .insert({
        mortgage_id: data.mortgage_id,
        owner_id: data.owner_id,
        label: data.label,
        track_type: data.track_type,
        principal: data.principal,
        annual_rate: data.annual_rate,
        prime_rate: data.prime_rate ?? null,
        margin: data.margin ?? null,
        term_months: data.term_months,
        grace_months: data.grace_months,
        start_date: data.start_date,
      })
      .select().single()
    if (error) throw error
    return row as MortgageTrack
  }
}

export async function deleteMortgageTrack(id: string): Promise<void> {
  const { error } = await supabase.from('mortgage_tracks').delete().eq('id', id)
  if (error) throw error
}
