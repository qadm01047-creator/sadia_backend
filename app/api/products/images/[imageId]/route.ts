import { NextRequest } from 'next/server';
import { getById, update } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, ProductImage } from '@/types';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { imageId: string } }
) {
  try {
    requireAdmin(req);

    // Find product that contains this image
    const products = getAll<Product>('products');
    const product = products.find(p => 
      p.images?.some(img => img.id === params.imageId)
    );

    if (!product) {
      return errorResponse('Image not found', 404);
    }

    // Remove image from product
    const updatedImages = (product.images || []).filter(
      img => img.id !== params.imageId
    );

    update<Product>('products', product.id, {
      images: updatedImages,
      updatedAt: new Date().toISOString(),
    });

    return successResponse({ message: 'Image deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Delete product image error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

