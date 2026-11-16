import "server-only";

/**
 * Live-stream chat delivery, inside our own server (replaces Supabase Realtime).
 *
 * Every phone watching a live keeps one connection open to
 * /api/storefront/lives/[id]/stream. When a comment is written (live-service postMessage) it is
 * pushed to every open connection for that live, and the viewer count is pushed whenever someone
 * joins or leaves. The website runs as one process on the server, so an in-memory list of open
 * connections is the whole system: no database round trip per message.
 *
 * The database is still the record: comments are saved first, and the page still fetches the list
 * on open and every few seconds, so a dropped connection never loses anything.
 */

type Client = { role: "viewer" | "host"; send: (event: string, data: unknown) => void };

const g = globalThis as unknown as { __liveRooms?: Map<string, Set<Client>> };
const rooms: Map<string, Set<Client>> = (g.__liveRooms ??= new Map());

function viewersIn(room: Set<Client>): number {
  let n = 0;
  for (const c of room) if (c.role !== "host") n++;
  return n;
}

function announceCount(liveId: string) {
  const room = rooms.get(liveId);
  if (!room) return;
  const viewers = viewersIn(room);
  for (const c of room) c.send("viewers", { viewers });
}

/** Join a live's room. Returns the function that leaves it. */
export function joinRoom(liveId: string, client: Client): () => void {
  let room = rooms.get(liveId);
  if (!room) rooms.set(liveId, (room = new Set()));
  room.add(client);
  announceCount(liveId);
  return () => {
    const r = rooms.get(liveId);
    if (!r) return;
    r.delete(client);
    if (r.size === 0) rooms.delete(liveId);
    else announceCount(liveId);
  };
}

/** Push a new comment to everyone watching this live. */
export function publishComment(liveId: string, message: unknown) {
  const room = rooms.get(liveId);
  if (!room) return;
  for (const c of room) c.send("comment", message);
}
