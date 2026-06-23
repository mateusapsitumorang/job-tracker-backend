import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const signAccessToken = (userId) => {
  return jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

export const generateRefreshTokenValue = () => crypto.randomBytes(48).toString('hex');

export const refreshTokenExpiryDate = () => {
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};
