import { NextResponse } from 'next/server'
import { getChatServerClient } from '@/lib/chat/supabase-server'

export const dynamic = 'force-dynamic'

// POST /api/inbox/take-over
// Body: { conversation_id, staff_id?, reason? }
// Escalates the conversation — agent stops drafting, a human owns the thread.
export async function POST(req: Request) {
  try {
    const { conversation_id, staff_id, reason } = (await req.json()) as {
      conversation_id: string
      staff_id?: string
      reason?: string
    }
    if (!conversation_id) {
      return NextResponse.json(
        { success: false, error: 'conversation_id is required' },
        { status: 400 },
      )
    }

    const supabase = getChatServerClient()
    const { error } = await supabase
      .from('conversations')
      .update({
        status: 'escalated',
        assigned_staff_id: staff_id ?? null,
      })
      .eq('id', conversation_id)
    if (error) throw error

    // Cancel any still-pending drafts on this conversation so the customer
    // can't accidentally receive an auto-reply after a takeover.
    await supabase
      .from('messages')
      .update({ reviewed_at: new Date().toISOString(), was_sent: false })
      .eq('conversation_id', conversation_id)
      .eq('requires_review', true)
      .is('reviewed_at', null)

    // Log a system note so the takeover is visible in the thread.
    const { data: conv } = await supabase
      .from('conversations')
      .select('customer_id')
      .eq('id', conversation_id)
      .single()
    if (conv) {
      await supabase.from('messages').insert({
        conversation_id,
        customer_id: conv.customer_id,
        role: 'system',
        content: `👤 Staff took over this conversation${reason ? ` — ${reason}` : ''}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
