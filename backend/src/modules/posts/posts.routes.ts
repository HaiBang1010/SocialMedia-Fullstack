import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { createPostSchema, updatePostSchema } from './posts.schema';
import * as postsService from './posts.service';

const router = Router();

/**
 * POST /posts — tạo post (ảnh và/hoặc caption).
 */
router.post(
  '/',
  requireAuth,
  validate(createPostSchema),
  asyncHandler(async (req, res) => {
    const post = await postsService.createPost(req.user!.id, req.body);
    res.status(201).json(post);
  }),
);

/**
 * GET /posts/:id — xem 1 post. optionalAuth để biết viewer có phải owner không.
 * Post private/followers + non-owner → 404 (ẩn existence).
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const post = await postsService.getPostById(req.params.id, req.user?.id);
    res.json(post);
  }),
);

/**
 * PATCH /posts/:id — sửa caption/visibility (chỉ owner).
 */
router.patch(
  '/:id',
  requireAuth,
  validate(updatePostSchema),
  asyncHandler(async (req, res) => {
    const post = await postsService.updatePost(req.params.id, req.user!.id, req.body);
    res.json(post);
  }),
);

/**
 * DELETE /posts/:id — xóa post + media trên S3 (chỉ owner).
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await postsService.deletePost(req.params.id, req.user!.id);
    res.status(204).send();
  }),
);

export default router;
