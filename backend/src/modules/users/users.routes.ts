import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { updateProfileSchema } from './users.schema';
import * as usersService from './users.service';
import { paginationSchema } from '../posts/posts.schema';
import * as postsService from '../posts/posts.service';

const router = Router();

/**
 * PATCH /users/me
 * Header: Authorization: Bearer <accessToken>
 * Body: { name?, bio?, avatarUrl?, isPrivate? }
 */
router.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateProfile(req.user!.id, req.body);
    res.json({ user });
  })
);

/**
 * GET /users/:username
 * Public — xem profile của bất kỳ user nào.
 */
router.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const user = await usersService.getUserByUsername(req.params.username);
    res.json({ user });
  })
);

/**
 * GET /users/:username/posts
 * List post của 1 user (cho ProfilePage). optionalAuth để áp visibility theo viewer.
 * Trả { posts, nextCursor } — cursor pagination.
 */
router.get(
  '/:username/posts',
  optionalAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await postsService.listPostsByUsername(
      req.params.username,
      req.user?.id,
      req.query as any,
    );
    res.json(result);
  })
);

export default router;
