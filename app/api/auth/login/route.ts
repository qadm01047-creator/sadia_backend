import { NextRequest } from 'next/server';
import { findOne } from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { User } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const user = findOne<User>('users', (u) => u.email === email);
    
    if (!user) {
      return errorResponse('Invalid credentials', 401);
    }

    const isValidPassword = await comparePassword(password, user.password);
    
    if (!isValidPassword) {
      return errorResponse('Invalid credentials', 401);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;

    return successResponse({
      token,
      user: userWithoutPassword,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

