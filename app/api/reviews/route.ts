import { NextRequest } from 'next/server';
import { getAll, create } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Review } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const approved = searchParams.get('approved');

    let reviews = getAll<Review>('reviews');

    if (productId) {
      reviews = reviews.filter(r => r.productId === productId);
    }

    // По умолчанию показываем только подтвержденные отзывы (если параметр не указан)
    if (approved !== null) {
      const approvedBool = approved === 'true';
      reviews = reviews.filter(r => r.approved === approvedBool);
    } else {
      // Если параметр approved не передан, показываем только подтвержденные
      reviews = reviews.filter(r => r.approved === true);
    }

    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse(reviews);
  } catch (error: any) {
    console.error('Get reviews error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, text, rating, productId, orderId } = data;

    if (!name || !text || !rating) {
      return errorResponse('Name, text, and rating are required', 400);
    }

    if (rating < 1 || rating > 5) {
      return errorResponse('Rating must be between 1 and 5', 400);
    }

    const review = create<Review>('reviews', {
      name,
      text,
      rating,
      approved: false, // Require admin approval
      productId,
      orderId,
      createdAt: new Date().toISOString(),
    });

    return successResponse(review, 201);
  } catch (error: any) {
    console.error('Create review error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

