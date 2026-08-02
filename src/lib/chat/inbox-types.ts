// Shared inbox types — used by API routes, hooks, and the InboxTab UI.
// These map 1:1 to chat.conversations + chat.messages + chat.customer_profiles.

export type Channel = 'whatsapp' | 'instagram' | 'messenger' | 'email' | 'web' | 'baileys'
export type ConvStatus = 'active' | 'idle' | 'escalated' | 'resolved' | 'archived'
export type UiStatus = 'needs_review' | 'active' | 'escalated' | 'resolved'
export type Priority = 'urgent' | 'active' | 'new' | 'idle' | 'vip'
export type Confidence = 'high' | 'medium' | 'low'
export type Role = 'customer' | 'agent' | 'staff' | 'system'

export interface InboxConversation {
  id: string
  customerId: string
  customerName: string | null
  customerPhone: string | null
  igHandle: string | null
  channel: Channel
  waChannelId: string | null
  status: UiStatus
  dbStatus: ConvStatus
  lastMessage: string
  lastMessageAt: string // relative ("2 min ago")
  lastMessageAtIso: string
  lastCustomerAtIso: string | null // last inbound message timestamp — used for 24h window check
  intent: string
  confidence: Confidence
  model: string
  unread: boolean
  lifetimeOrders: number
  lifetimeValue: number
  tags: string[]
  assignedStaffId: string | null
  assignedStaffName: string | null
  priority: Priority
  botPaused: boolean
  pendingReviewCount: number
}

export interface WaChannel {
  id: string
  phoneNumberId: string
  displayName: string
  phoneNumber: string | null
  isDefault: boolean
  isActive: boolean
}

export type MediaType = 'image' | 'audio' | 'video' | 'document'
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface InboxMessage {
  id: string
  conversationId: string
  role: Role
  content: string
  timestamp: string // HH:mm
  timestampIso: string
  confidence?: Confidence
  model?: string
  toolsUsed?: string[]
  requiresReview?: boolean
  reviewReason?: string
  mediaUrl?: string
  mediaType?: MediaType
  wasSent?: boolean
  reviewedAt?: string | null
  staffName?: string | null
  editedAt?: string | null
  deletedAt?: string | null
  waMessageId?: string | null
  score?: number | null
  deliveryStatus?: DeliveryStatus
  sendError?: string | null
}

export interface InboxCustomer {
  id: string
  name: string | null
  phone: string | null
  igHandle: string | null
  email: string | null
  tags: string[]
  notes: string | null
  lifetimeOrders: number
  lifetimeValue: number
  tonePreference: string | null
  preferredLanguage: string | null
  firstContactAt: string
  lastSeenAt: string
}
