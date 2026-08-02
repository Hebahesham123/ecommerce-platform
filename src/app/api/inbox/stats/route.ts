// @ts-nocheck — faithful port from dashboard-web; Supabase rows are untyped here
import { NextResponse } from 'next/server'
import { getChatServerClient } from '@/lib/chat/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/inbox/stats — today's inbox headline numbers.
export async function GET() {
  try {
    const supabase = getChatServerClient()
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const iso = todayStart.toISOString()

    const { data: today, error: todayErr } = await supabase
      .from('messages')
      .select('id, role, was_sent, requires_review, reviewed_at, cost_usd, staff_edit_distance')
      .gte('created_at', iso)
    if (todayErr) throw todayErr

    const all = today ?? []
    const handled = all.filter((m) => m.role !== 'customer').length
    const autoSent = all.filter(
      (m) => m.role === 'agent' && m.was_sent && !m.requires_review,
    ).length
    const agentOut = all.filter((m) => m.role === 'agent').length
    const autoSentPct = agentOut > 0 ? Math.round((autoSent / agentOut) * 100) : 0
    const cost = all.reduce((s, m) => s + Number(m.cost_usd ?? 0), 0)
    const editedDrafts = all.filter(
      (m) => (m.staff_edit_distance ?? 0) > 0.01,
    ).length

    const { count: pendingReview } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('requires_review', true)
      .is('reviewed_at', null)

    const { count: escalated } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'escalated')

    return NextResponse.json({
      success: true,
      data: {
        handledToday: handled,
        autoSentPct,
        costUsdToday: Number(cost.toFixed(3)),
        editedDraftsToday: editedDrafts,
        pendingReview: pendingReview ?? 0,
        escalated: escalated ?? 0,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('[inbox/stats]', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
