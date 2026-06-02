import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { paginationSchema } from '../posts/posts.schema';
import * as feedService from './feed.service';

const router = Router();

/**
 * GET /feed — personalized feed (posts from following users, last 14 days).
 * requireAuth (KHÔNG optionalAuth) — feed luôn cần biết viewer là ai.
 */
router.get(
  '/',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await feedService.getFeed(req.user!.id, req.query as any);
    res.json(result);
  }),
);

export default router;
