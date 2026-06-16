import { env } from '../config/env';

/**
 * Phase 6 — thin wrapper over livekit-server-sdk (mirrors lib/s3.ts's helper style).
 *
 * livekit-server-sdk v2 is ESM-only, but this backend compiles to CommonJS (tsconfig
 * `module: node16`, no `"type": "module"`). A static `import` would emit `require()` →
 * ERR_REQUIRE_ESM on Node < 22.12. A dynamic `import()` is preserved verbatim by tsc under
 * node16 and works in BOTH tsx (dev) and the compiled build, on any Node version. We cache the
 * module promise so the import happens once.
 */
// Route through a helper so the cache variable inherits the dynamic import()'s type (ESM
// resolution-mode under node16). Annotating with the sync `typeof import(...)` resolves in CJS
// mode and clashes with the ESM-mode promise that import() actually returns.
function importLiveKit() {
  return import('livekit-server-sdk');
}
let modPromise: ReturnType<typeof importLiveKit> | null = null;
function lk(): ReturnType<typeof importLiveKit> {
  if (!modPromise) modPromise = importLiveKit();
  return modPromise;
}

/** Soft cap on participants per call (Decision Q2). Enforced at the SFU via createRoom +
 *  pre-checked in getCallAccessToken (409 CallFull). The FE also guards. */
export const MAX_CALL_PARTICIPANTS = 50;

/** Access-token TTL (Decision: 1 hour; long-call refresh is Phase polish). */
const TOKEN_TTL = '1h';

/** The wss:// signaling URL handed to the client. */
export const livekitUrl = env.LIVEKIT_URL;

/**
 * Mint a LiveKit access token for one participant joining one room. identity = our userId
 * (so server-side participant lookups map back to a user), name = username (display label).
 * v2 `toJwt()` is async.
 */
export async function generateAccessToken(
  userId: string,
  username: string,
  roomName: string,
): Promise<string> {
  const { AccessToken } = await lk();
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: userId,
    name: username,
    ttl: TOKEN_TTL,
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  return at.toJwt();
}

// RoomServiceClient talks to the LiveKit HTTP API (control plane — does NOT count toward the
// participant-minute quota). Its host is the https:// form of the wss:// signaling URL.
let roomService: Awaited<ReturnType<typeof makeRoomService>> | null = null;
async function makeRoomService() {
  const { RoomServiceClient } = await lk();
  const httpUrl = env.LIVEKIT_URL.replace(/^ws/, 'http'); // wss:// → https://, ws:// → http://
  return new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}
async function getRoomService() {
  if (!roomService) roomService = await makeRoomService();
  return roomService;
}

/**
 * Create the LiveKit room for a call with a hard participant cap + an empty-room auto-cleanup
 * timeout (Decision Q2). Idempotent/soft-fail: if it errors (room already exists, transient),
 * we log and continue — LiveKit auto-creates the room on first join anyway, and the
 * getCallAccessToken cap check still guards. roomName = the Call id.
 */
export async function createCallRoom(roomName: string): Promise<void> {
  try {
    const svc = await getRoomService();
    await svc.createRoom({ name: roomName, maxParticipants: MAX_CALL_PARTICIPANTS, emptyTimeout: 600 });
  } catch (err) {
    console.error(`[livekit] createRoom(${roomName}) failed (continuing):`, err);
  }
}

/**
 * Current participant count in a room. Returns 0 if the room doesn't exist yet (nobody has
 * connected) — listParticipants throws for an unknown room. Used for the 50-cap check and the
 * group auto-end-on-last-leaver logic.
 */
export async function getRoomParticipantCount(roomName: string): Promise<number> {
  try {
    const svc = await getRoomService();
    const participants = await svc.listParticipants(roomName);
    return participants.length;
  } catch {
    return 0;
  }
}

/**
 * Delete a room → LiveKit force-disconnects every remaining participant (each client's
 * onDisconnected fires → it leaves). Called when a call is finalized so "end for everyone" and
 * the last-participant cleanup actually tear the room down, not just flip the DB row. Soft-fail:
 * a missing room (already gone) is fine.
 */
export async function deleteRoom(roomName: string): Promise<void> {
  try {
    const svc = await getRoomService();
    await svc.deleteRoom(roomName);
  } catch (err) {
    console.error(`[livekit] deleteRoom(${roomName}) failed (continuing):`, err);
  }
}
