import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { createPostSchema, updatePostSchema, paginationSchema } from './posts.schema';
import * as postsService from './posts.service';
import * as likesService from '../likes/likes.service';
import * as commentsService from '../comments/comments.service';
import { createCommentSchema, updateCommentSchema } from '../comments/comments.schema';

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

/**
 * POST /posts/:id/like — like a post (idempotent). Auth required.
 */
router.post(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await likesService.likePost(req.user!.id, req.params.id);
    res.json(result);
  }),
);

/**
 * DELETE /posts/:id/like — unlike a post (idempotent). Auth required.
 */
router.delete(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await likesService.unlikePost(req.user!.id, req.params.id);
    res.json(result);
  }),
);

/**
 * POST /posts/:id/comments — add a comment. Auth required.
 */
router.post(
  '/:id/comments',
  requireAuth,
  validate(createCommentSchema),
  asyncHandler(async (req, res) => {
    const comment = await commentsService.createComment(req.user!.id, req.params.id, req.body);
    res.status(201).json(comment);
  }),
);

/**
 * GET /posts/:id/comments — list comments (newest first, cursor pagination).
 * optionalAuth so FOLLOWERS/owner posts resolve visibility per viewer.
 */
router.get(
  '/:id/comments',
  optionalAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await commentsService.listComments(req.params.id, req.user?.id, req.query as any);
    res.json(result);
  }),
);

export default router;

/**
 * Separate router mounted at /comments (in server.ts) for comment edit/delete by comment id.
 * Kept in this file (no standalone comments.routes.ts) per the agreed module layout;
 * the posts router is mounted at /posts so it cannot itself produce absolute /comments paths.
 */
export const commentsRouter = Router();

/**
 * PATCH /comments/:id — edit a comment (author only). Auth required.
 */
commentsRouter.patch(
  '/:id',
  requireAuth,
  validate(updateCommentSchema),
  asyncHandler(async (req, res) => {
    const comment = await commentsService.updateComment(req.params.id, req.user!.id, req.body);
    res.json(comment);
  }),
);

/**
 * DELETE /comments/:id — delete a comment (comment author or post author). Auth required.
 */
commentsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await commentsService.deleteComment(req.params.id, req.user!.id);
    res.status(204).send();
  }),
);
