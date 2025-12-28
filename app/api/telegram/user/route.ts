import { NextRequest } from 'next/server';
import { getAll, getById, create, update } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { User, Order, TelegramUserMapping, UserRole } from '@/types';

// Get user info by Telegram ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramUserId = searchParams.get('telegramUserId');

    if (!telegramUserId) {
      return errorResponse('telegramUserId is required', 400);
    }

    // Try to find user in User table by telegramUserId
    const users = getAll<User>('users');
    const user = users.find((u) => u.telegramUserId === telegramUserId);

    if (user) {
      return successResponse({
        telegramUserId,
        userId: user.id,
        role: user.role,
        hasOrders: true,
      });
    }

    // Try to find in TelegramUserMapping collection (if exists)
    try {
      const mappings = getAll<TelegramUserMapping>('telegramUserMappings');
      const mapping = mappings.find((m) => m.telegramUserId === telegramUserId);

      if (mapping) {
        return successResponse({
          telegramUserId,
          userId: mapping.userId,
          role: mapping.role,
          hasOrders: false,
        });
      }
    } catch (error) {
      // Collection doesn't exist yet, that's fine
    }

    // Check if user has orders
    const orders = getAll<Order>('orders');
    const order = orders.find((o) => o.telegramUserId === telegramUserId);

    // Default role is USER
    return successResponse({
      telegramUserId,
      role: 'USER' as UserRole,
      hasOrders: !!order,
    });
  } catch (error: any) {
    console.error('Get Telegram user error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

// Create or update Telegram user mapping
export async function POST(req: NextRequest) {
  try {
    const { telegramUserId, userId, role } = await req.json();

    if (!telegramUserId) {
      return errorResponse('telegramUserId is required', 400);
    }

    // Try to find existing mapping
    try {
      const mappings = getAll<TelegramUserMapping>('telegramUserMappings');
      const existing = mappings.find((m) => m.telegramUserId === telegramUserId);

      if (existing) {
        // Update existing mapping
        const updated = update<TelegramUserMapping>('telegramUserMappings', existing.id, {
          userId: userId || existing.userId,
          role: (role || existing.role) as UserRole,
          updatedAt: new Date().toISOString(),
        });
        return successResponse(updated);
      }
    } catch (error) {
      // Collection doesn't exist yet, will create new mapping
    }

    // Create new mapping
    const mapping = create<TelegramUserMapping>('telegramUserMappings', {
      telegramUserId,
      userId,
      role: (role || 'USER') as UserRole,
      createdAt: new Date().toISOString(),
    });

    return successResponse(mapping, 201);
  } catch (error: any) {
    console.error('Create Telegram user mapping error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

