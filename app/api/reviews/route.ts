import { NextRequest } from 'next/server';
import { getAllAsync, createAsync } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Review } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/reviews:
 *   get:
 *     summary: Get all reviews
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *         description: Filter by product ID
 *       - in: query
 *         name: approved
 *         schema:
 *           type: boolean
 *         description: Filter by approval status
 *     responses:
 *       200:
 *         description: List of reviews
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - text
 *               - rating
 *             properties:
 *               name:
 *                 type: string
 *               text:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               productId:
 *                 type: string
 *               orderId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Bad request
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const approved = searchParams.get('approved');

    let reviews = await getAllAsync<Review>('reviews');

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

    const review = await createAsync<Review>('reviews', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

