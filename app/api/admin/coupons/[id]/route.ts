import { NextRequest } from 'next/server';
import { getById, update, remove, getAll } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Coupon } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const coupon = getById<Coupon>('coupons', params.id);

    if (!coupon) {
      return errorResponse('Coupon not found', 404);
    }

    return successResponse(coupon);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get coupon error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const data = await req.json();
    const { code, discount, discountType, oneTime, expiresAt, used, usedBy } = data;

    const existingCoupon = getById<Coupon>('coupons', params.id);
    if (!existingCoupon) {
      return errorResponse('Coupon not found', 404);
    }

    // Check if code is being changed and if new code already exists
    if (code && code !== existingCoupon.code) {
      const coupons = getAll<Coupon>('coupons');
      const duplicateCoupon = coupons.find(c => c.code === code && c.id !== params.id);
      if (duplicateCoupon) {
        return errorResponse('Coupon with this code already exists', 400);
      }
    }

    const updateData: any = {};

    if (code !== undefined) updateData.code = code;
    if (discount !== undefined) updateData.discount = parseFloat(discount.toString());
    if (discountType !== undefined) updateData.discountType = discountType;
    if (oneTime !== undefined) updateData.oneTime = oneTime;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
    if (used !== undefined) updateData.used = used;
    if (usedBy !== undefined) updateData.usedBy = usedBy;

    const updatedCoupon = update<Coupon>('coupons', params.id, updateData);

    if (!updatedCoupon) {
      return errorResponse('Coupon not found', 404);
    }

    return successResponse(updatedCoupon);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Update coupon error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const deleted = remove('coupons', params.id);

    if (!deleted) {
      return errorResponse('Coupon not found', 404);
    }

    return successResponse({ message: 'Coupon deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Delete coupon error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

