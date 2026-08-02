// @ts-nocheck — faithful port from dashboard-web; Supabase rows are untyped here
import { NextResponse } from 'next/server'
import { getChatServerClient } from '@/lib/chat/supabase-server'
import { mapConversation } from '@/lib/chat/inbox-mappers'

export const dynamic = 'force-dynamic'
export const maxDuration = 25

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0)
    const status = url.searchParams.get('status')
    const channelId = url.searchParams.get('channel_id')
    const unreadOnly = url.searchParams.get('unread_only') === 'true'

    const supabase = getChatServerClient()

    let convQ = supabase
      .from('conversations')
      .select(
        'id, customer_id, channel, status, last_message_at, last_customer_at, assigned_staff_id, summary',
      )
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (channelId && channelId !== 'all') {
      convQ = convQ.eq('wa_channel_id', channelId)
    }

    if (status && status !== 'all') {
      if (status === 'escalated') convQ = convQ.eq('status', 'escalated')
      else if (status === 'resolved') convQ = convQ.in('status', ['resolved', 'archived'])
      else if (status === 'active') convQ = convQ.in('status', ['active', 'idle'])
    }

    // For unread-only, PostgREST can't compare two columns (last_customer_at > last_read_at).
    // So we fetch candidates with last_customer_at NOT NULL and last_read_at IS NULL first,
    // plus those with last_read_at set. Then we do the column comparison in JS before mapping.
    if (unreadOnly) {
      // Fetch conversations that COULD be unread (have customer messages)
      // We'll filter the column comparison after fetching
      convQ = convQ.not('last_customer_at', 'is', null)
    }

    const { data: convs, error: convErr } = await convQ
    if (convErr) throw convErr
    if (!convs || convs.length === 0) {
      return NextResponse.json({ success: true, data: [], pagination: { offset, limit, count: 0, hasMore: false } })
    }

    const customerIds = [...new Set(convs.map((c) => c.customer_id))]
    const conversationIds = convs.map((c) => c.id)

    const CHUNK = 200
    const msgChunks: string[][] = []
    for (let i = 0; i < conversationIds.length; i += CHUNK) {
      msgChunks.push(conversationIds.slice(i, i + CHUNK))
    }

    const [custResult, ...msgResults] = await Promise.all([
      supabase
        .from('customer_profiles')
        .select('id, name, phone, ig_handle, tags, lifetime_orders, lifetime_value_egp')
        .in('id', customerIds),
      ...msgChunks.map((chunk) =>
        supabase
          .from('messages')
          .select(
            'id, conversation_id, role, content, intent, confidence, model, requires_review, review_reason, reviewed_at, was_sent, media_urls, media_analysis, tool_calls, created_at',
          )
          .in('conversation_id', chunk)
          .order('created_at', { ascending: false })
          .limit(chunk.length * 3)
      ),
    ])

    if (custResult.error) throw custResult.error
    const byCustomer = new Map((custResult.data ?? []).map((c) => [c.id, c]))

    const lastByConv = new Map<string, any>()
    const pendingByConv = new Map<string, number>()
    for (const result of msgResults) {
      if (result.error) throw result.error
      for (const m of (result.data ?? []) as any[]) {
        if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m)
        if (m.requires_review && !m.reviewed_at) {
          pendingByConv.set(m.conversation_id, (pendingByConv.get(m.conversation_id) ?? 0) + 1)
        }
      }
    }

    // Apply unread filter in JS (column comparison not possible in PostgREST)
    const filteredConvs = unreadOnly
      ? convs.filter((c) => {
          if (!c.last_customer_at) return false
          if (!c.last_read_at) return true
          return new Date(c.last_customer_at) > new Date(c.last_read_at)
        })
      : convs

    const mapped = filteredConvs
      .map((c) => {
        const customer = byCustomer.get(c.customer_id)
        if (!customer) return null
        return mapConversation(
          c,
          customer,
          lastByConv.get(c.id) ?? null,
          pendingByConv.get(c.id) ?? 0,
        )
      })
      .filter((x: any): x is NonNullable<typeof x> => x !== null)

    return NextResponse.json({
      success: true,
      data: mapped,
      pagination: {
        offset,
        limit,
        count: mapped.length,
        hasMore: !unreadOnly && mapped.length === limit,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('[inbox/conversations]', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
