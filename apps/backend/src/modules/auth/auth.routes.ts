import { Router } from 'express';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authLimiter, validate } from '@/middlewares';
import * as controller from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  verifyEmailSchema,
} from './auth.validation';

export const authRouter = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Create an account with email + password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: Account created; refresh cookie set }
 *       409: { description: Email already registered }
 */
authRouter.post('/auth/register', authLimiter, validate({ body: registerSchema }), asyncHandler(controller.register));

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Sign in with email + password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               rememberMe: { type: boolean }
 *     responses:
 *       200: { description: Signed in; refresh cookie set }
 *       401: { description: Invalid credentials }
 */
authRouter.post('/auth/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate the refresh token and mint a new access token
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200: { description: New access token }
 *       401: { description: Missing/invalid/reused refresh token }
 */
authRouter.post('/auth/refresh', asyncHandler(controller.refresh));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current session
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out }
 */
authRouter.post('/auth/logout', authenticate, asyncHandler(controller.logout));

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     summary: Revoke every session for this account
 *     tags: [Auth]
 *     responses:
 *       200: { description: All sessions revoked }
 */
authRouter.post('/auth/logout-all', authenticate, asyncHandler(controller.logoutAll));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Current user profile + workspace memberships
 *     tags: [Auth]
 *     responses:
 *       200: { description: Profile }
 */
authRouter.get('/auth/me', authenticate, asyncHandler(controller.me));

/**
 * @openapi
 * /auth/sessions:
 *   get:
 *     summary: List active device sessions
 *     tags: [Auth]
 *     responses:
 *       200: { description: Sessions with current-device flag }
 */
authRouter.get('/auth/sessions', authenticate, asyncHandler(controller.listSessions));

/**
 * @openapi
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific device session
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Session revoked }
 */
authRouter.delete(
  '/auth/sessions/:sessionId',
  authenticate,
  validate({ params: sessionIdParamSchema }),
  asyncHandler(controller.revokeSession)
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password-reset email
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200: { description: Uniform success (no account enumeration) }
 */
authRouter.post(
  '/auth/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(controller.forgotPassword)
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Set a new password using an emailed token
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200: { description: Password updated; all sessions revoked }
 *       400: { description: Invalid or expired token }
 */
authRouter.post(
  '/auth/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(controller.resetPassword)
);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     summary: Verify email using an emailed token
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200: { description: Email verified }
 */
authRouter.post('/auth/verify-email', validate({ body: verifyEmailSchema }), asyncHandler(controller.verifyEmail));

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     summary: Resend the verification email
 *     tags: [Auth]
 *     responses:
 *       200: { description: Sent }
 */
authRouter.post('/auth/resend-verification', authenticate, authLimiter, asyncHandler(controller.resendVerification));

// --------------------------------------------------------------------------
// OAuth (browser redirects — no JSON envelopes)
// --------------------------------------------------------------------------

authRouter.get('/auth/google', asyncHandler(controller.oauthStart('google')));
authRouter.get('/auth/google/callback', asyncHandler(controller.oauthCallback('google')));
authRouter.get('/auth/github', asyncHandler(controller.oauthStart('github')));
authRouter.get('/auth/github/callback', asyncHandler(controller.oauthCallback('github')));
