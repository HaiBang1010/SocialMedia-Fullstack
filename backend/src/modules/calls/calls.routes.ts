import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { startCallSchema, endCallSchema } from './calls.schema';
import * as callsService from './calls.service';

// Phase 6 — call lifecycle. LiveKit handles WebRTC; these endpoints mint tokens + track state.
// "Accept" is not a route: a recipient calls POST /calls/:id/token then connects to LiveKit,
// and the initiator learns of the join via LiveKit's ParticipantConnected event.
const router = Router();

/** POST /calls/start — open a call in a conversation. Returns the CALL message + initiator token. */
router.post(
  '/start',
  requireAuth,
  validate(startCallSchema),
  asyncHandler(async (req, res) => {
    const result = await callsService.createCall(req.user!.id, req.body.conversationId, req.body.type);
    res.status(201).json(result);
  }),
);

/** POST /calls/:id/token — get a LiveKit access token to join an existing call (the accept path). */
router.post(
  '/:id/token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await callsService.getCallAccessToken(req.params.id, req.user!.id);
    res.json(result);
  }),
);

/** POST /calls/:id/decline — recipient declines an incoming call. Returns the CALL message. */
router.post(
  '/:id/decline',
  requireAuth,
  asyncHandler(async (req, res) => {
    const message = await callsService.declineCall(req.params.id, req.user!.id);
    res.json(message);
  }),
);

/** POST /calls/:id/end — leave or end-for-all. Returns the (possibly updated) CALL message. */
router.post(
  '/:id/end',
  requireAuth,
  validate(endCallSchema),
  asyncHandler(async (req, res) => {
    const message = await callsService.endCall(req.params.id, req.user!.id, req.body.action, req.body.reason);
    res.json(message);
  }),
);

export default router;
