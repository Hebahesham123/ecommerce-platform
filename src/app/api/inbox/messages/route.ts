import { NextResponse } from 'next/server'
import { getChatServerClient } from '@/lib/chat/supabase-server'
import { mapMessage } from '@/lib/chat/inbox-mappers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversation_id')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)
    const before = url.searchParams.get('before') // ISO timestamp cursor for older messages
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversation_id is required' },
        { status: 400 },
      )
    }

    const supabase = getChatServerClient()

    // We fetch the LAST N messages (most recent).
    // If `before` is provided, we fetch messages older than that timestamp.
    // Strategy: fetch desc, then reverse to get chronological order.
    let q = supabase
      .from('messages')
      .select(
        'id, conversation_id, role, content, media_urls, media_analysis, intent, confidence, model, tool_calls, requires_review, review_reason, reviewed_at, was_sent, created_at, error',
      )
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit + 1) // fetch 1 extra to detect hasMore

    if (before) {
      q = q.lt('created_at', before)
    }

    const { data, error } = await q
    if (error) throw error

    const rows = data ?? []
    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows

    // Reverse to chronological order (oldest first)
    const chronological = sliced.reverse()

    return NextResponse.json({
      success: true,
      data: chronological.map(mapMessage),
      pagination: {
        limit,
        count: chronological.length,
        hasMore,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
