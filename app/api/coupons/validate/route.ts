import { NextRequest } from 'next/server';
import { getAll } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Coupon } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code) {
      return errorResponse('Coupon code is required', 400);
    }

    const coupons = getAll<Coupon>('coupons');
    const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase());

    if (!coupon) {
      return errorResponse('Coupon not found', 404);
    }

    // Check if coupon is already used (if it's one-time)
    const isOneTime = (coupon as any).oneTime || coupon.oneTimeUse;
    if (isOneTime && coupon.used) {
      return errorResponse('Coupon has already been used', 400);
    }

    // Check if coupon has expired
    const expiresAt = (coupon as any).expiresAt || coupon.validUntil;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return errorResponse('Coupon has expired', 400);
    }

    return successResponse({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount: coupon.discount,
        discountType: coupon.discountType,
      },
    });
  } catch (error: any) {
    console.error('Validate coupon error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}


