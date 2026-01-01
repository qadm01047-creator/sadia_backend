import { NextRequest } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { getByIdAsync } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { User } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user details
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = requireAuth(req);
    const user = await getByIdAsync<User>('users', authUser.id);

    if (!user) {
      return errorResponse('User not found', 404);
    }

    const { password: _, ...userWithoutPassword } = user;

    return successResponse(userWithoutPassword);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    console.error('Get current user error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

