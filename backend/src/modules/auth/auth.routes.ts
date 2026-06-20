import { Router, type CookieOptions } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { registerSchema, loginSchema } from './auth.schema';
import * as authService from './auth.service';

const router = Router();

// Phase Polish — the refresh token is delivered as an httpOnly cookie (unreadable by JS, mitigates
// XSS token theft) instead of in the response body. path '/auth' scopes it to the auth endpoints.
// PROD is cross-site (FE on Vercel ↔ BE on Railway), so the cookie needs sameSite 'none' to be sent
// on cross-origin XHR — and the browser requires Secure when SameSite=None. We set secure: true
// unconditionally (prod is HTTPS; localhost is treated as a secure context by Chrome/Firefox, so
// dev still works). maxAge mirrors the 7d refresh-token lifetime.
const REFRESH_COOKIE = 'refreshToken';
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/**
 * POST /auth/register
 * Body: { username, email, password, name }
 * Returns: { user, accessToken } + sets the refreshToken httpOnly cookie.
 */
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken, ...rest } = await authService.register(req.body);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    res.status(201).json(rest);
  })
);

/**
 * POST /auth/login
 * Body: { identifier, password }   // identifier = email hoặc username
 * Returns: { user, accessToken } + sets the refreshToken httpOnly cookie.
 */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken, ...rest } = await authService.login(req.body);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
    res.json(rest);
  })
);

/**
 * POST /auth/refresh
 * Reads the refreshToken from the httpOnly cookie (no body).
 * Returns: { accessToken }. Non-rotating — does NOT issue a new refresh cookie.
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new AppError(401, 'InvalidRefreshToken', 'No refresh token');
    }
    const result = await authService.refresh(token);
    res.json(result);
  })
);

/**
 * GET /auth/me
 * Header: Authorization: Bearer <accessToken>
 * Returns: { user }
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    // requireAuth đã set req.user
    const user = await authService.getCurrentUser(req.user!.id);
    res.json({ user });
  })
);

/**
 * POST /auth/logout
 * Clears the refreshToken httpOnly cookie (path must match the one set at login). The access token
 * is in-memory on the client, so dropping the cookie + clearing client state ends the session.
 */
router.post('/logout', (req, res) => {
  // Must match the SET attributes (path + sameSite + secure) so the browser actually clears the
  // cross-site cookie (a SameSite=None/Secure cookie won't be removed by a bare path-only clear).
  res.clearCookie(REFRESH_COOKIE, { path: '/auth', sameSite: 'none', secure: true, httpOnly: true });
  res.status(204).end();
});

export default router;
