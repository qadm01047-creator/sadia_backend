import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { User } from '@/types';

// Get telegramUserId by phone number
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return errorResponse('Phone number is required', 400);
    }

    // Normalize phone number (remove spaces, +, etc.)
    const normalizedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');

    // Find user by phone number
    const users = getAll<User>('users');
    const user = users.find((u) => {
      if (!u.phone) return false;
      const userPhone = u.phone.replace(/\s+/g, '').replace(/^\+/, '');
      return userPhone === normalizedPhone;
    });

    if (!user || !user.telegramUserId) {
      return successResponse({ telegramUserId: null });
    }

    return successResponse({ telegramUserId: user.telegramUserId });
  } catch (error: any) {
    console.error('Get telegramUserId by phone error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

