import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import crypto from 'crypto';
import { signAccessToken, generateRefreshTokenValue, refreshTokenExpiryDate } from '../utils/jwt.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: true, 
  sameSite: 'none', 
  path: '/', 
  expires: refreshTokenExpiryDate(),
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

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: 'Email reset telah dikirim jika akun terdaftar.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 jam

    await prisma.user.update({
      where: { email },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    const headerSrc = process.env.EMAIL_HEADER_URL || null;

    await transporter.sendMail({
      from: `"Job Tracker" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Kata Sandi Job Tracker',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        </head>
        <body style="margin:0; padding:0; background:#f4f6f5; font-family: 'Segoe UI', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                  
                  <!-- HEADER IMAGE -->
                  ${headerSrc ? `
                  <tr>
                    <td style="padding:0; margin:0;">
                      <img src="${headerSrc}" alt="Job Tracker" width="520" style="display:block; width:100%; max-width:520px; height:auto;" />
                    </td>
                  </tr>
                  ` : `
                  <tr>
                    <td style="background:#15803d; padding: 28px 40px;">
                      <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700;">Job Tracker</h1>
                    </td>
                  </tr>
                  `}

                  <!-- BODY -->
                  <tr>
                    <td style="padding: 36px 40px 20px;">
                      <h2 style="color:#0f172a; font-size:20px; font-weight:700; margin: 0 0 12px;">Reset Kata Sandi</h2>
                      <p style="color:#475569; font-size:14px; line-height:1.7; margin: 0 0 8px;">
                        Halo <strong>${user.name || 'Pengguna'}</strong>,
                      </p>
                      <p style="color:#475569; font-size:14px; line-height:1.7; margin: 0 0 28px;">
                        Kami menerima permintaan untuk mengatur ulang kata sandi akun Job Tracker Anda. Klik tombol di bawah untuk membuat kata sandi baru.
                      </p>

                      <!-- BUTTON -->
                      <table cellpadding="0" cellspacing="0" style="margin: 0 auto 28px;">
                        <tr>
                          <td align="center" style="background:#15803d; border-radius:10px;">
                            <a href="${resetUrl}"
                              style="display:inline-block; padding: 14px 36px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:10px;">
                              Reset Kata Sandi
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="color:#64748b; font-size:13px; line-height:1.6; margin: 0 0 8px;">
                        Atau salin tautan berikut ke browser Anda:
                      </p>
                      <p style="margin: 0 0 28px;">
                        <a href="${resetUrl}" style="color:#15803d; font-size:12px; word-break:break-all;">${resetUrl}</a>
                      </p>

                      <div style="background:#f8fafc; border-radius:8px; padding:14px 16px; margin-bottom:8px;">
                        <p style="color:#94a3b8; font-size:12px; line-height:1.6; margin:0;">
                          Tautan ini hanya berlaku selama <strong>1 jam</strong>. Jika Anda tidak meminta reset kata sandi, abaikan email ini akun Anda tetap aman.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- FOOTER -->
                  <tr>
                    <td style="padding: 20px 40px 32px; border-top: 1px solid #f1f5f9;">
                      <p style="color:#cbd5e1; font-size:12px; text-align:center; margin:0;">
                        © ${new Date().getFullYear()} Job Tracker · Email ini dikirim otomatis, mohon tidak membalas.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    return res.json({ message: 'Email reset telah dikirim jika akun terdaftar.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Tautan tidak valid atau sudah kedaluwarsa.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return res.json({ message: 'Kata sandi berhasil diubah.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};