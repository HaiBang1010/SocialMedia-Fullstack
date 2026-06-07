import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import * as commentsService from './comments.service';
import { updateCommentSchema, replyListQuerySchema } from './comments.schema';

/**
 * Router mounted at /comments (in server.ts) for comment-id-scoped operations.
 * Root comments live under /posts/:id/comments (see posts.routes.ts) since they
 * are addressed by the post id; everything keyed by a comment id lives here.
 */
const router = Router();

/**
 * GET /comments/:id/replies — list a comment's replies (chronological, cursor pagination).
 * optionalAuth so FOLLOWERS/owner posts resolve visibility per viewer.
 */
router.get(
  '/:id/replies',
  optionalAuth,
  validate(replyListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await commentsService.listReplies(req.params.id, req.user?.id, req.query as any);
    res.json(result);
  }),
);

/**
 * PATCH /comments/:id — edit a comment (author only). Auth required.
 */
router.patch(
  '/:id',
  requireAuth,
  validate(updateCommentSchema),
  asyncHandler(async (req, res) => {
    const comment = await commentsService.updateComment(req.params.id, req.user!.id, req.body);
    res.json(comment);
  }),
);

/**
 * DELETE /comments/:id — delete a comment (comment author only). Auth required.
 * Cascade removes the comment's replies.
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await commentsService.deleteComment(req.params.id, req.user!.id);
    res.status(204).send();
  }),
);

export default router;
