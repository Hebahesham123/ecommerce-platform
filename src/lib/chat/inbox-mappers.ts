import type {
  Channel,
  ConvStatus,
  Confidence,
  DeliveryStatus,
  InboxConversation,
  InboxMessage,
  MediaType,
  Priority,
  UiStatus,
} from './inbox-types'
import { STAFF_MEMBERS } from './constants'

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.max(0, Math.floor((now - then) / 1000))
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

export function formatClock(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-EG', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** WhatsApp-style date label: TODAY, YESTERDAY, day name, or full date */
export function dateDividerLabel(iso: string): string {
  const cairo = { timeZone: 'Africa/Cairo' as const }
  const d = new Date(iso)
  const now = new Date()

  const msgDate = d.toLocaleDateString('en-CA', cairo)
  const todayDate = now.toLocaleDateString('en-CA', cairo)
  if (msgDate === todayDate) return 'TODAY'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (msgDate === yesterday.toLocaleDateString('en-CA', cairo)) return 'YESTERDAY'

  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString('en-US', { ...cairo, weekday: 'long' }).toUpperCase()
  }

  return d.toLocaleDateString('en-GB', {
    ...cairo,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).toUpperCase()
}

// Collapse DB status + pending-review signal into a UI status bucket.
export function toUiStatus(
  dbStatus: ConvStatus,
  pendingReview: number,
): UiStatus {
  if (pendingReview > 0) return 'needs_review'
  if (dbStatus === 'escalated') return 'escalated'
  if (dbStatus === 'resolved' || dbStatus === 'archived') return 'resolved'
  return 'active'
}

type ConvRow = {
  id: string
  customer_id: string
  channel: Channel
  wa_channel_id?: string | null
  status: ConvStatus
  priority?: string | null
  bot_paused?: boolean | null
  last_message_at: string
  last_customer_at: string | null
  last_read_at: string | null
  assigned_staff_id: string | null
  summary: string | null
}

type CustomerRow = {
  id: string
  name: string | null
  phone: string | null
  ig_handle: string | null
  tags: string[] | null
  lifetime_orders: number | null
  lifetime_value_egp: number | string | null
}

type MessageRow = {
  id: string
  conversation_id: string
  role: 'customer' | 'agent' | 'staff' | 'system'
  content: string | null
  media_urls: string[] | null
  media_analysis: { type?: MediaType } | null
  intent: string | null
  confidence: Confidence | null
  model: string | null
  tool_calls: Array<{ tool: string; args: unknown; result_summary?: string }> | null
  requires_review: boolean
  review_reason: string | null
  reviewed_at: string | null
  was_sent: boolean
  staff_name: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
  wa_message_id: string | null
  score: number | null
  delivery_status: DeliveryStatus | null
  error: string | null
}

export function mapConversation(
  conv: ConvRow,
  customer: CustomerRow,
  lastMsg: MessageRow | null,
  pendingReviewCount: number,
): InboxConversation {
  const lastContent = lastMsg?.content ?? ''
  const intent = lastMsg?.intent ?? 'other'
  const confidence = lastMsg?.confidence ?? 'high'
  const model = lastMsg?.model ?? 'haiku-4-5'
  // Unread = customer sent a message after crew last read, OR there are unsent drafts
  const unread = Boolean(
    (conv.last_customer_at &&
    (!conv.last_read_at || new Date(conv.last_customer_at) > new Date(conv.last_read_at)))
    || pendingReviewCount > 0
  )

  return {
    id: conv.id,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    igHandle: customer.ig_handle,
    channel: conv.channel,
    waChannelId: conv.wa_channel_id ?? null,
    status: toUiStatus(conv.status, pendingReviewCount),
    dbStatus: conv.status,
    lastMessage: lastContent,
    lastMessageAt: relativeTime(conv.last_message_at),
    lastMessageAtIso: conv.last_message_at,
    lastCustomerAtIso: conv.last_customer_at ?? null,
    intent,
    confidence,
    model,
    unread,
    lifetimeOrders: customer.lifetime_orders ?? 0,
    lifetimeValue: Number(customer.lifetime_value_egp ?? 0),
    tags: customer.tags ?? [],
    assignedStaffId: conv.assigned_staff_id,
    assignedStaffName: STAFF_MEMBERS.find((s) => s.id === conv.assigned_staff_id)?.name ?? null,
    priority: (conv.priority as Priority) ?? 'active',
    botPaused: conv.bot_paused ?? false,
    pendingReviewCount,
  }
}

export function mapMessage(row: MessageRow): InboxMessage {
  const tools = Array.isArray(row.tool_calls)
    ? row.tool_calls.map((t) => {
        const name = typeof t?.tool === 'string' ? t.tool : 'tool'
        const args = t?.args && typeof t.args === 'object' ? JSON.stringify(t.args) : ''
        return args ? `${name}(${args})` : name
      })
    : undefined

  // Determine media type: from media_analysis, or infer from content for legacy messages
  let mediaType: MediaType | undefined = (row.media_analysis?.type as MediaType) ?? undefined
  if (!mediaType && row.media_urls && row.media_urls.length > 0) {
    const c = (row.content ?? '').toLowerCase()
    if (c.includes('[image]') || c.startsWith('📷')) mediaType = 'image'
    else if (c.includes('[audio]') || c.includes('[voice note]')) mediaType = 'audio'
    else if (c.includes('[video]')) mediaType = 'video'
    else if (c.includes('[document')) mediaType = 'document'
    else mediaType = 'image' // default assumption for legacy media
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content ?? '',
    timestamp: formatClock(row.created_at),
    timestampIso: row.created_at,
    confidence: row.confidence ?? undefined,
    model: row.model ?? undefined,
    toolsUsed: tools && tools.length ? tools : undefined,
    requiresReview: row.requires_review && !row.reviewed_at,
    reviewReason: row.review_reason ?? undefined,
    mediaUrl: row.media_urls?.[0],
    mediaType,
    wasSent: row.was_sent,
    reviewedAt: row.reviewed_at,
    staffName: row.staff_name ?? undefined,
    editedAt: row.edited_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    waMessageId: row.wa_message_id ?? undefined,
    score: row.score ?? undefined,
    deliveryStatus: row.delivery_status ?? undefined,
    sendError: row.error ?? undefined,
  }
}
