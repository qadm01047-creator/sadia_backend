import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/middleware/auth';
import { getByIdAsync, updateAsync, removeAsync } from '@/lib/db';
import { Product } from '@/types';

/**
 * DELETE /api/pos/products/:productId/remove
 * Remove/delete a product from POS (admin only)
 * Optional: Move to inactive instead of full deletion
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    // Only ADMIN+ can remove products
    const user = requireRole(req, ['ADMIN', 'SUPERADMIN']);

    const { productId } = params;
    const url = new URL(req.url);
    const method = url.searchParams.get('method') || 'deactivate'; // deactivate | delete

    if (!productId) {
      return NextResponse.json(
        { success: false, message: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Get product to verify it exists
    const product = await getByIdAsync<Product>('products', productId);
    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    let result;

    if (method === 'deactivate') {
      // Deactivate: Set active_for_pos to false (safe, reversible)
      await updateAsync<Product>('products', productId, {
        active_for_pos: false,
        updatedAt: new Date().toISOString(),
      });
      result = {
        id: productId,
        name: product.name,
        method: 'deactivated',
        message: 'Product deactivated from POS',
      };
    } else {
      // Full deletion (irreversible, use with caution)
      await removeAsync('products', productId);
      result = {
        id: productId,
        name: product.name,
        method: 'deleted',
        message: 'Product permanently deleted',
      };
    }

    // Log the action for audit trail
    console.log(`Product removal: ${method}`, {
      productId,
      productName: product.name,
      userId: user.id,
      userName: user.email,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    console.error('Product removal error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove product' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pos/products/batch-remove
 * Remove multiple products at once via barcode scanner
 * Useful for quickly removing bulk items
 */
export async function POST(req: NextRequest) {
  try {
    // Only ADMIN+ can remove products
    const user = requireRole(req, ['ADMIN', 'SUPERADMIN']);

    const body = await req.json();
    const { productIds = [], method = 'deactivate' } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Product IDs array is required' },
        { status: 400 }
      );
    }

    const results = {
      success: [] as any[],
      failed: [] as any[],
    };

    for (const productId of productIds) {
      try {
        const product = await getByIdAsync<Product>('products', productId);
        if (!product) {
          results.failed.push({
            productId,
            error: 'Product not found',
          });
          continue;
        }

        if (method === 'deactivate') {
          await updateAsync<Product>('products', productId, {
            active_for_pos: false,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await removeAsync('products', productId);
        }

        results.success.push({
          productId,
          name: product.name,
          method,
        });
      } catch (err) {
        results.failed.push({
          productId,
          error: String(err),
        });
      }
    }

    // Log batch operation
    console.log(`Batch product removal: ${method}`, {
      count: results.success.length,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: results.failed.length === 0,
      data: results,
      message: `${results.success.length} products ${method}d, ${results.failed.length} failed`,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    console.error('Batch product removal error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process batch removal' },
      { status: 500 }
    );
  }
}
