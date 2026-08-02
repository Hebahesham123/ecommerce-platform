import { NextResponse } from 'next/server'
import { getChatServerClient } from '@/lib/chat/supabase-server'
import { sendText, getChannelCreds, type ChannelCreds } from '@/lib/whatsapp/client'
import { STAFF_MEMBERS } from '@/lib/chat/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/inbox/send — staff composes and ships a reply directly from the
// dashboard. Goes straight to WhatsApp Cloud API (no n8n hop, no Chatwoot).
// Body: { conversation_id, content, staff_id? }
export async function POST(req: Request) {
  try {
    const { conversation_id, content, staff_id } = (await req.json()) as {
      conversation_id: string
      content: string
      staff_id?: string
    }
    if (!conversation_id || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'conversation_id and content are required' },
        { status: 400 },
      )
    }

    const supabase = getChatServerClient()
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('customer_id, channel, wa_channel_id')
      .eq('id', conversation_id)
      .single()
    if (convErr || !conv) throw convErr ?? new Error('conversation not found')

    const { data: customer } = await supabase
      .from('customer_profiles')
      .select('phone')
      .eq('id', conv.customer_id)
      .single()
    if (!customer?.phone) {
      return NextResponse.json(
        { success: false, error: 'customer phone missing — cannot send' },
        { status: 400 },
      )
    }

    let externalId: string | null = null
    let sendError: string | null = null

    // Baileys channel: send via the gateway, not Meta Cloud API
    if (conv.channel === 'baileys') {
      const gatewayUrl = process.env.BAILEYS_GATEWAY_URL
      const gatewaySecret = process.env.BAILEYS_GATEWAY_SECRET || ''
      if (!gatewayUrl) {
        sendError = 'BAILEYS_GATEWAY_URL not configured'
      } else {
        try {
          const phone = customer.phone.replace(/^\+/, '')
          const res = await fetch(`${gatewayUrl}/send-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Gateway-Secret': gatewaySecret,
            },
            body: JSON.stringify({ phone, text: content.trim() }),
          })
          if (res.ok) {
            const body = await res.json().catch(() => ({}))
            externalId = (body as Record<string, unknown>).messageId as string ?? null
            console.log(`[send] Baileys message sent to ${phone}`)
          } else {
            sendError = `Baileys gateway error ${res.status}: ${await res.text().catch(() => '')}`
          }
        } catch (e) {
          sendError = e instanceof Error ? e.message : String(e)
        }
      }
    } else {
      // Meta Cloud API (WhatsApp/IG/Messenger)
      let creds: ChannelCreds | undefined
      if (conv.wa_channel_id) {
        creds = await getChannelCreds(conv.wa_channel_id)
      }

      try {
        const waRes = await sendText(customer.phone, content.trim(), undefined, creds)
        externalId = waRes.messages?.[0]?.id ?? null
      } catch (e) {
        const firstErr = e instanceof Error ? e.message : String(e)
        console.error('[send] FAILED with channel creds, trying fallback:', firstErr)
        if (creds) {
          try {
            const waRes = await sendText(customer.phone, content.trim(), undefined, undefined)
            externalId = waRes.messages?.[0]?.id ?? null
            console.log('[send] Fallback with default creds SUCCEEDED')
          } catch (e2) {
            sendError = e2 instanceof Error ? e2.message : String(e2)
          }
        } else {
          sendError = firstErr
        }
      }
    }

    const now = new Date().toISOString()
    const staffName = STAFF_MEMBERS.find((s) => s.id === staff_id)?.name ?? null
    const { data: inserted, error: insErr } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        customer_id: conv.customer_id,
        role: 'staff',
        content: content.trim(),
        reviewed_at: now,
        was_sent: !sendError,
        sent_at: sendError ? null : now,
        external_message_id: externalId,
        error: sendError,
      })
      .select('id')
      .single()
    if (insErr) throw insErr

    // Auto-dismiss any pending bot drafts — crew chose to reply directly
    await supabase
      .from('messages')
      .update({ reviewed_at: now, requires_review: false })
      .eq('conversation_id', conversation_id)
      .eq('requires_review', true)
      .is('reviewed_at', null)

    // Update conversation timestamp + mark as read
    await supabase
      .from('conversations')
      .update({ last_message_at: now })
      .eq('id', conversation_id)

    return NextResponse.json({
      success: !sendError,
      message_id: inserted.id,
      external_id: externalId,
      wa_error: sendError ?? undefined,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
