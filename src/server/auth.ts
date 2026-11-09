import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  id: number;
  username: string;
  displayName?: string;
  role: string;
  avatarUrl?: string | null;
  isGuest?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'sami-auth-secret-key-salt-98213';

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

export function generateToken(payload: AuthUser, expiresInDays = 30): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): AuthUser | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSig) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return {
      id: Number(payload.id),
      username: String(payload.username || ''),
      displayName: payload.displayName ? String(payload.displayName) : undefined,
      role: String(payload.role || 'user'),
      avatarUrl: payload.avatarUrl || null,
      isGuest: Boolean(payload.isGuest),
    };
  } catch {
    return null;
  }
}

const sessionCache = new Map<number, { user: AuthUser; time: number }>();

export function clearAuthSessionCache(userId: number) {
  sessionCache.delete(userId);
}

export function authenticateToken(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  } else if (req.query?.token) {
    const user = verifyToken(String(req.query.token).trim());
    if (user) {
      req.user = user;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول للوصول إلى هذا المورد' });
  }
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'غير مصرح لك بالوصول إلى هذا الإجراء' });
    }
    next();
  };
}
