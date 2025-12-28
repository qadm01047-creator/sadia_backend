import { NextRequest } from 'next/server';
import { getAll, create } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Coupon } from '@/types';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const coupons = getAll<Coupon>('coupons');
    return successResponse(coupons);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get coupons error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);

    const data = await req.json();
    const { code, discount, discountType, oneTimeUse, validFrom, validUntil } = data;

    if (!code || discount === undefined || !discountType) {
      return errorResponse('code, discount, and discountType are required', 400);
    }

    // Check if coupon code already exists
    const coupons = getAll<Coupon>('coupons');
    const existingCoupon = coupons.find(c => c.code === code);
    if (existingCoupon) {
      return errorResponse('Coupon with this code already exists', 400);
    }

    const now = new Date().toISOString();
    const coupon = create<Coupon>('coupons', {
      code,
      discount: parseFloat(discount.toString()),
      discountType,
      validFrom: validFrom || now,
      validUntil: validUntil || now,
      oneTimeUse: oneTimeUse || false,
      used: false,
      createdAt: now,
    });

    return successResponse(coupon, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Create coupon error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

