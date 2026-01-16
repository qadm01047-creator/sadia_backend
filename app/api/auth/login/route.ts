import { NextRequest } from 'next/server';
import { findOneAsync } from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { User } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
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
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Missing required fields
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    // Debug logging
    console.log('Login attempt for email:', email);
    
    const user = await findOneAsync<User>('users', (u) => u.email === email);
    
    // Debug logging
    if (!user) {
      console.log('User not found for email:', email);
      // Try to get all users for debugging
      const { getAllAsync } = await import('@/lib/db');
      const allUsers = await getAllAsync<User>('users');
      console.log('Total users in database:', allUsers.length);
      console.log('User emails:', allUsers.map(u => u.email));
      return errorResponse('Invalid credentials', 401);
    }
    
    console.log('User found:', { id: user.id, email: user.email, role: user.role });

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

