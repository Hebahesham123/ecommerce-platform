// WhatsApp Cloud API client. Server-only — never import into a client component.
// All outbound message types we use: text, template, interactive list.
// Also exposes HMAC verification for inbound webhooks signed by Meta.

import crypto from 'crypto'

const GRAPH = 'https://graph.facebook.com'

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (!v) throw new Error(`${name} is not set`)
  return v
}

function apiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || 'v21.0'
}

function defaultPhoneNumberId(): string {
  return env('WHATSAPP_PHONE_NUMBER_ID')
}

function resolvePhoneNumberId(channelPhoneNumberId?: string): string {
  return channelPhoneNumberId || defaultPhoneNumberId()
}

export interface ChannelCreds {
  phoneNumberId?: string
  accessToken?: string
}

function defaultAccessToken(): string {
  return env('WHATSAPP_ACCESS_TOKEN')
}

function businessAccountId(): string {
  return env('WHATSAPP_BUSINESS_ACCOUNT_ID')
}

async function graphPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const url = `${GRAPH}/${apiVersion()}/${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token || defaultAccessToken()}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WhatsApp API ${res.status}: ${text}`)
  }
  return (await res.json()) as T
}

async function graphGet<T>(path: string, token?: string): Promise<T> {
  const url = `${GRAPH}/${apiVersion()}/${path}`
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token || defaultAccessToken()}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WhatsApp API ${res.status}: ${text}`)
  }
  return (await res.json()) as T
}

export function normalisePhone(input: string | null | undefined): string {
  if (!input) return ''
  // Strip all whitespace, quotes, and non-essential chars
  let p = String(input).replace(/[\s'"​ ]/g, '')
  // Remove leading + or 00
  if (p.startsWith('+')) p = p.slice(1)
  else if (p.startsWith('00')) p = p.slice(2)
  // Strip any remaining non-digit chars
  const digits = p.replace(/\D/g, '')
  // Egyptian local number (01XXXXXXXXX) → add country code
  if (digits.startsWith('01') && digits.length === 11) return '2' + digits
  // Fix double-zero after country code: 2001XXXXXXXX → 201XXXXXXXX
  if (digits.startsWith('200') && digits.length === 13) return '2' + digits.slice(2)
  return digits
}

export interface SendTextResult {
  messages: Array<{ id: string }>
  contacts: Array<{ wa_id: string; input: string }>
}

export async function sendText(to: string, body: string, channelPhoneNumberId?: string, creds?: ChannelCreds): Promise<SendTextResult> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId ?? channelPhoneNumberId)
  return graphPost<SendTextResult>(`${pnId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalisePhone(to),
    type: 'text',
    text: { body, preview_url: true },
  }, creds?.accessToken)
}

export type TemplateParam =
  | { type: 'text'; text: string }
  | { type: 'currency'; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: 'date_time'; date_time: { fallback_value: string } }
  | { type: 'payload'; payload: string }

export type TemplateComponent =
  | { type: 'header'; parameters: TemplateParam[] }
  | { type: 'body'; parameters: TemplateParam[] }
  | { type: 'button'; sub_type: 'url' | 'quick_reply'; index: string; parameters: TemplateParam[] }

export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components: TemplateComponent[] = [],
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId ?? channelPhoneNumberId)
  return graphPost<SendTextResult>(`${pnId}/messages`, {
    messaging_product: 'whatsapp',
    to: normalisePhone(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  }, creds?.accessToken)
}

export async function sendOrderConfirmationTemplate(
  to: string,
  firstName: string,
  orderName: string,
  totalWithCurrency: string,
  languageCode = 'en',
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  return sendTemplate(to, 'order_confirmation_v2', languageCode, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: firstName || 'Beautiful' },
        { type: 'text', text: orderName },
        { type: 'text', text: totalWithCurrency },
      ],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '0',
      parameters: [{ type: 'payload', payload: 'choose_date' }],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '1',
      parameters: [{ type: 'payload', payload: 'view_order' }],
    },
  ], channelPhoneNumberId, creds)
}

export async function sendOrderDepositTemplate(
  to: string,
  firstName: string,
  orderName: string,
  totalWithCurrency: string,
  languageCode = 'en',
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  return sendTemplate(to, 'order_confirmation_deposit', languageCode, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: firstName || 'Beautiful' },
        { type: 'text', text: orderName },
        { type: 'text', text: totalWithCurrency },
      ],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '0',
      parameters: [{ type: 'payload', payload: 'choose_date' }],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '1',
      parameters: [{ type: 'payload', payload: 'view_order' }],
    },
  ], channelPhoneNumberId, creds)
}

export async function sendOrderDepositHalfTemplate(
  to: string,
  firstName: string,
  orderName: string,
  totalWithCurrency: string,
  depositAmount: string,
  languageCode = 'ar',
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  return sendTemplate(to, 'order_confirmation_deposit_half', languageCode, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: firstName || 'Beautiful' },
        { type: 'text', text: orderName },
        { type: 'text', text: totalWithCurrency },
        { type: 'text', text: depositAmount },
      ],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '0',
      parameters: [{ type: 'payload', payload: 'choose_date' }],
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '1',
      parameters: [{ type: 'payload', payload: 'view_order' }],
    },
  ], channelPhoneNumberId, creds)
}

export async function sendOrderReviewTemplate(
  to: string,
  firstName: string,
  orderName: string,
  languageCode = 'en',
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  return sendTemplate(to, 'order_review_v3', languageCode, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: firstName || 'there' },
        { type: 'text', text: orderName },
      ],
    },
  ], channelPhoneNumberId, creds)
}

export async function sendCartReminderTemplate(
  to: string,
  customerName: string,
  itemsSummary: string,
  total: string,
  checkoutUrl: string,
  languageCode = 'en',
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  // cart_reminder_v4 URL button is https://beauty-bareg.net/{{1}}
  // Extract the path after the domain from the full Shopify checkout URL
  const cartBtnPath = checkoutUrl.replace(/^https?:\/\/[^/]+\//, '') || checkoutUrl
  return sendTemplate(to, 'cart_reminder_v4', languageCode, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: itemsSummary || 'your items' },
        { type: 'text', text: total || '' },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: cartBtnPath }],
    },
  ], channelPhoneNumberId, creds)
}

export async function sendCartReminderFollowupTemplate(
  to: string,
  customerName: string,
  checkoutUrl: string,
  languageCode = 'en',
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  return sendTemplate(to, 'cart_reminder_followup_v2', languageCode, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: checkoutUrl }],
    },
  ], channelPhoneNumberId, creds)
}

export interface ListRow {
  id: string
  title: string
  description?: string
}

export interface ListSection {
  title: string
  rows: ListRow[]
}

export async function sendInteractiveList(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: ListSection[],
  headerText?: string,
  footerText?: string,
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId ?? channelPhoneNumberId)
  return graphPost<SendTextResult>(`${pnId}/messages`, {
    messaging_product: 'whatsapp',
    to: normalisePhone(to),
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(headerText ? { header: { type: 'text', text: headerText } } : {}),
      body: { text: bodyText },
      ...(footerText ? { footer: { text: footerText } } : {}),
      action: { button: buttonText, sections },
    },
  }, creds?.accessToken)
}

export interface ReplyButton {
  id: string
  title: string
}

export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: ReplyButton[],
  headerText?: string,
  footerText?: string,
  channelPhoneNumberId?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId ?? channelPhoneNumberId)
  return graphPost<SendTextResult>(`${pnId}/messages`, {
    messaging_product: 'whatsapp',
    to: normalisePhone(to),
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(headerText ? { header: { type: 'text', text: headerText } } : {}),
      body: { text: bodyText },
      ...(footerText ? { footer: { text: footerText } } : {}),
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  }, creds?.accessToken)
}

export interface WABATemplate {
  name: string
  language: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | string
  category: string
  components: unknown[]
}

export async function listTemplates(): Promise<WABATemplate[]> {
  const res = await graphGet<{ data: WABATemplate[] }>(
    `${businessAccountId()}/message_templates?limit=200`,
  )
  return res.data ?? []
}

/** List templates for a specific channel's WABA. Falls back to default WABA if channel has none. */
export async function listTemplatesForChannel(channelId: string): Promise<WABATemplate[]> {
  const { getChatServerClient } = await import('@/lib/chat/supabase-server')
  const supabase = getChatServerClient()
  const { data: channel } = await supabase
    .from('wa_channels')
    .select('waba_id, access_token')
    .eq('id', channelId)
    .single()

  if (!channel?.waba_id || channel.waba_id === businessAccountId()) {
    return listTemplates()
  }

  const res = await graphGet<{ data: WABATemplate[] }>(
    `${channel.waba_id}/message_templates?limit=200`,
    channel.access_token ?? undefined,
  )
  return res.data ?? []
}

export async function listAllTemplates(): Promise<WABATemplate[]> {
  // Fetch templates from default WABA
  const defaultTemplates = await listTemplates()

  // Also fetch from any channel-specific WABAs
  const { getChatServerClient } = await import('@/lib/chat/supabase-server')
  const supabase = getChatServerClient()
  const { data: channels } = await supabase
    .from('wa_channels')
    .select('waba_id, access_token')
    .eq('is_active', true)
    .not('waba_id', 'is', null)

  const seenWabas = new Set<string>([businessAccountId()])
  const allTemplates = [...defaultTemplates]

  for (const ch of channels ?? []) {
    if (!ch.waba_id || seenWabas.has(ch.waba_id)) continue
    seenWabas.add(ch.waba_id)
    try {
      const res = await graphGet<{ data: WABATemplate[] }>(
        `${ch.waba_id}/message_templates?limit=200`,
        ch.access_token ?? undefined,
      )
      allTemplates.push(...(res.data ?? []))
    } catch {
      // skip channels with invalid tokens
    }
  }

  // Deduplicate by name+language
  const seen = new Set<string>()
  return allTemplates.filter((t) => {
    const key = `${t.name}:${t.language}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function markRead(messageId: string, channelPhoneNumberId?: string, creds?: ChannelCreds): Promise<void> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId ?? channelPhoneNumberId)
  await graphPost(`${pnId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  }, creds?.accessToken)
}

export async function uploadMedia(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string,
  creds?: ChannelCreds,
): Promise<string> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId)
  const token = creds?.accessToken || defaultAccessToken()
  const url = `${GRAPH}/${apiVersion()}/${pnId}/media`

  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mimeType)
  form.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), filename)

  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WhatsApp media upload ${res.status}: ${text}`)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

export async function sendImage(
  to: string,
  mediaId: string,
  caption?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId)
  return graphPost<SendTextResult>(`${pnId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalisePhone(to),
    type: 'image',
    image: { id: mediaId, ...(caption ? { caption } : {}) },
  }, creds?.accessToken)
}

export async function sendAudio(
  to: string,
  mediaId: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId)
  return graphPost<SendTextResult>(`${pnId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalisePhone(to),
    type: 'audio',
    audio: { id: mediaId },
  }, creds?.accessToken)
}

export async function sendVideo(
  to: string,
  mediaId: string,
  caption?: string,
  creds?: ChannelCreds,
): Promise<SendTextResult> {
  const pnId = resolvePhoneNumberId(creds?.phoneNumberId)
  return graphPost<SendTextResult>(`${pnId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalisePhone(to),
    type: 'video',
    video: { id: mediaId, ...(caption ? { caption } : {}) },
  }, creds?.accessToken)
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return true
  if (!signatureHeader) return false
  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
  } catch {
    return false
  }
}

export function webhookVerifyToken(): string {
  return env('WHATSAPP_WEBHOOK_VERIFY_TOKEN')
}

export async function getChannelPhoneNumberId(waChannelId: string): Promise<string | undefined> {
  const creds = await getChannelCreds(waChannelId)
  return creds?.phoneNumberId
}

export async function getChannelCreds(waChannelId: string): Promise<ChannelCreds | undefined> {
  const { getChatServerClient } = await import('@/lib/chat/supabase-server')
  const supabase = getChatServerClient()
  const { data } = await supabase
    .from('wa_channels')
    .select('phone_number_id, access_token')
    .eq('id', waChannelId)
    .maybeSingle()
  if (!data?.phone_number_id) return undefined
  return {
    phoneNumberId: data.phone_number_id,
    accessToken: data.access_token ?? undefined,
  }
}

export async function getDefaultChannelId(): Promise<string | undefined> {
  const { getChatServerClient } = await import('@/lib/chat/supabase-server')
  const supabase = getChatServerClient()
  const { data } = await supabase
    .from('wa_channels')
    .select('id')
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()
  return data?.id ?? undefined
}

export async function getChannelByPhoneNumberId(phoneNumId: string): Promise<{ id: string; phone_number_id: string; display_name: string; access_token: string | null } | null> {
  const { getChatServerClient } = await import('@/lib/chat/supabase-server')
  const supabase = getChatServerClient()
  const { data } = await supabase
    .from('wa_channels')
    .select('id, phone_number_id, display_name, access_token')
    .eq('phone_number_id', phoneNumId)
    .maybeSingle()
  return data ?? null
}
