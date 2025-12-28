import { NextRequest } from 'next/server';
import { getById, update } from '@/lib/db';
import { requireAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { User } from '@/types';

export async function PUT(req: NextRequest) {
  try {
    const user = requireAuth(req);

    const data = await req.json();
    const { firstName, lastName, phone, address, cardNumber, cardExpiry, cardHolder } = data;

    const existingUser = getById<User>('users', user.id);
    
    if (!existingUser) {
      return errorResponse('User not found', 404);
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (cardNumber !== undefined) updateData.cardNumber = cardNumber;
    if (cardExpiry !== undefined) updateData.cardExpiry = cardExpiry;
    if (cardHolder !== undefined) updateData.cardHolder = cardHolder;

    const updatedUser = update<User>('users', user.id, updateData);

    if (!updatedUser) {
      return errorResponse('User not found', 404);
    }

    const { password: _, ...userWithoutPassword } = updatedUser;

    return successResponse({
      user: userWithoutPassword,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse(error.message, 401);
    }
    console.error('Update profile error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

