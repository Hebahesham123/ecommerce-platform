import { NextResponse } from 'next/server'
import { getChatServerClient } from '@/lib/chat/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/inbox/customer?customer_id=<uuid>
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const customerId = url.searchParams.get('customer_id')
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customer_id is required' },
        { status: 400 },
      )
    }

    const supabase = getChatServerClient()
    const { data, error } = await supabase
      .from('customer_profiles')
      .select(
        'id, name, phone, ig_handle, email, tags, notes, lifetime_orders, lifetime_value_egp, tone_preference, preferred_language, first_contact_at, last_seen_at',
      )
      .eq('id', customerId)
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

// PATCH /api/inbox/customer
// Body: { customer_id, tags?, notes?, add_tag?, remove_tag? }
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      customer_id: string
      tags?: string[]
      notes?: string
      add_tag?: string
      remove_tag?: string
    }
    if (!body.customer_id) {
      return NextResponse.json(
        { success: false, error: 'customer_id is required' },
        { status: 400 },
      )
    }

    const supabase = getChatServerClient()
    const patch: Record<string, unknown> = {}

    if (body.tags) {
      patch.tags = body.tags
    } else if (body.add_tag || body.remove_tag) {
      const { data: current, error: cErr } = await supabase
        .from('customer_profiles')
        .select('tags')
        .eq('id', body.customer_id)
        .single()
      if (cErr) throw cErr
      const set = new Set<string>(current?.tags ?? [])
      if (body.add_tag) set.add(body.add_tag)
      if (body.remove_tag) set.delete(body.remove_tag)
      patch.tags = [...set]
    }

    if (typeof body.notes === 'string') patch.notes = body.notes
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, noop: true })
    }

    const { error } = await supabase
      .from('customer_profiles')
      .update(patch)
      .eq('id', body.customer_id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
