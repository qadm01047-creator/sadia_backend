import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { UserRole } from '@/types';

export interface AuthRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export function authenticate(req: NextRequest): { id: string; email: string; role: UserRole } | null {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyToken(token);
}

export function requireAuth(req: NextRequest): { id: string; email: string; role: UserRole } {
  const user = authenticate(req);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export function requireRole(req: NextRequest, allowedRoles: UserRole[]): { id: string; email: string; role: UserRole } {
  const user = requireAuth(req);
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden');
  }
  return user;
}

export function requireAdmin(req: NextRequest): { id: string; email: string; role: UserRole } {
  return requireRole(req, ['SUPERADMIN', 'ADMIN']);
}

export function requireSuperAdmin(req: NextRequest): { id: string; email: string; role: UserRole } {
  return requireRole(req, ['SUPERADMIN']);
}

