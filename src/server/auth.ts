import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { dbInstance, User } from './db.js';

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: 'admin' | 'petugas';
  name: string;
  issuedAt: number;
}

// In-memory token storage (token -> payload)
const activeTokens = new Map<string, AuthTokenPayload>();

export function generateToken(user: User): string {
  const randomHex = crypto.randomBytes(16).toString('hex');
  const token = `tok_${user.role}_${user.id}_${randomHex}`;
  activeTokens.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    issuedAt: Date.now(),
  });
  return token;
}

export function verifyToken(token: string): AuthTokenPayload | null {
  if (!token) return null;
  const payload = activeTokens.get(token);
  if (payload) return payload;

  const data = dbInstance.getData();
  // Also accept our standard demo tokens for instant seed test login
  if (token === 'tok_demo_admin_default') {
    const admin = data.users.find(u => u.username === 'admin');
    if (admin) {
      return {
        userId: admin.id,
        username: admin.username,
        role: admin.role,
        name: admin.name,
        issuedAt: Date.now(),
      };
    }
  } else if (token === 'tok_demo_kasir_default') {
    const kasir = data.users.find(u => u.username === 'kasir');
    if (kasir) {
      return {
        userId: kasir.id,
        username: kasir.username,
        role: kasir.role,
        name: kasir.name,
        issuedAt: Date.now(),
      };
    }
  }

  // Restore token if it contains user id (tok_role_userId_hash)
  const parts = token.split('_');
  if (parts.length >= 4) {
    const role = parts[1] as 'admin' | 'petugas';
    const userId = parts[2];
    const user = data.users.find(u => u.id === userId && u.is_active);
    if (user && user.role === role) {
      const restoredPayload: AuthTokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        issuedAt: Date.now(),
      };
      activeTokens.set(token, restoredPayload);
      return restoredPayload;
    }
  }

  return null;
}

export function revokeToken(token: string): void {
  activeTokens.delete(token);
}

// Express extended request type
export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (payload) {
    req.user = payload;
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Silakan login terlebih dahulu untuk mengakses sumber daya ini.',
    });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Autentikasi diperlukan.',
    });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Akses terlarang: Fitur ini hanya dapat diakses oleh Administrator/Pemilik Toko.',
    });
  }
  next();
}
