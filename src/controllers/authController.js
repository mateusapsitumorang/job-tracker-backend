import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import {
  signAccessToken,
  generateRefreshTokenValue,
  refreshTokenExpiryDate,
} from '../utils/jwt.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  expires: refreshTokenExpiryDate(),
  path: '/api/auth',
});

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email sudah terdaftar.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    return res.status(201).json({
      message: 'Registrasi berhasil. Silakan login.',
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Email atau kata sandi salah.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Email atau kata sandi salah.' });
    }

    const accessToken = signAccessToken(user.id);
    const refreshTokenValue = generateRefreshTokenValue();

    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: refreshTokenExpiryDate(),
      },
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshTokenValue, refreshCookieOptions());

    return res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
};

// Dipanggil saat access token expired di frontend, untuk dapat access token baru
// tanpa harus login ulang -> ini yang membuat sesi "tidak harus login setiap hari".
export const refresh = async (req, res) => {
  try {
    const tokenValue = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!tokenValue) {
      return res.status(401).json({ message: 'Sesi tidak ditemukan. Silakan login kembali.' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: tokenValue } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Sesi sudah berakhir. Silakan login kembali.' });
    }

    const accessToken = signAccessToken(stored.userId);
    return res.json({ accessToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
};

export const logout = async (req, res) => {
  try {
    const tokenValue = req.cookies?.[REFRESH_COOKIE_NAME];
    if (tokenValue) {
      await prisma.refreshToken.deleteMany({ where: { token: tokenValue } });
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    return res.json({ message: 'Logout berhasil.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
};

export const me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return res.json({ user });
};
