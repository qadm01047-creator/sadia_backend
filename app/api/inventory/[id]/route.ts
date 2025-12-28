import { NextRequest } from 'next/server';
import { getById, update, remove, getAll } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Inventory, Product } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const inventoryItem = getById<Inventory>('inventory', params.id);

    if (!inventoryItem) {
      return errorResponse('Inventory item not found', 404);
    }

    // Populate product information
    const products = getAll<Product>('products');
    const product = products.find(p => p.id === inventoryItem.productId) || null;

    return successResponse({
      ...inventoryItem,
      product,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Get inventory item error:', error);
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
    const { quantity, size } = data;

    const existingItem = getById<Inventory>('inventory', params.id);
    if (!existingItem) {
      return errorResponse('Inventory item not found', 404);
    }

    // Check if trying to change size and if new size already exists
    if (size && size !== existingItem.size) {
      const inventory = getAll<Inventory>('inventory');
      const duplicateItem = inventory.find(
        item => item.productId === existingItem.productId && 
                item.size === size && 
                item.id !== params.id
      );
      if (duplicateItem) {
        return errorResponse('Inventory item with this product and size already exists', 400);
      }
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (quantity !== undefined) {
      updateData.quantity = parseInt(quantity.toString());
    }

    if (size !== undefined) {
      updateData.size = size;
    }

    const updatedItem = update<Inventory>('inventory', params.id, updateData);

    if (!updatedItem) {
      return errorResponse('Inventory item not found', 404);
    }

    return successResponse(updatedItem);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Update inventory error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const deleted = remove('inventory', params.id);

    if (!deleted) {
      return errorResponse('Inventory item not found', 404);
    }

    return successResponse({ message: 'Inventory item deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Delete inventory error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

