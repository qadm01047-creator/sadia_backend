import { NextRequest } from 'next/server';
import { createAsync, findOneAsync } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { User } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, firstName, lastName, phone, address } = await req.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    const existingUser = await findOneAsync<User>('users', (u) => u.email === email);
    
    if (existingUser) {
      return errorResponse('User with this email already exists', 400);
    }

    const hashedPassword = await hashPassword(password);

    const user = await createAsync<User>('users', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email,
      password: hashedPassword,
      role: 'USER',
      firstName,
      lastName,
      phone,
      address,
      createdAt: new Date().toISOString(),
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;

    return successResponse({
      token,
      user: userWithoutPassword,
    }, 201);
  } catch (error: any) {
    console.error('Registration error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

