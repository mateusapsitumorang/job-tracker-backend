import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, refresh, logout, me, forgotPassword, resetPassword } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';


const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Email tidak valid.'),
    body('password').isLength({ min: 8 }).withMessage('Kata sandi minimal 8 karakter.'),
    body('name').optional().isString().trim(),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email tidak valid.'),
    body('password').notEmpty().withMessage('Kata sandi wajib diisi.'),
  ],
  validate,
  login
);

router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Email tidak valid.')],
  validate,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Minimal 8 karakter.'),
  ],
  validate,
  resetPassword
);

export default router;
