import { NextRequest } from 'next/server';
import { getById, update, getAll, create, remove } from '@/lib/db';
import { requireAdmin } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Product, ProductImage } from '@/types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = getById<Product>('products', params.id);

    if (!product) {
      return errorResponse('Product not found', 404);
    }

    const images = product.images || [];
    return successResponse(images.sort((a, b) => (a.order || 0) - (b.order || 0)));
  } catch (error: any) {
    console.error('Get product images error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireAdmin(req);

    const product = getById<Product>('products', params.id);
    if (!product) {
      return errorResponse('Product not found', 404);
    }

    // Support both JSON (URL) and FormData (file upload)
    const contentType = req.headers.get('content-type') || '';
    let imageUrl: string;
    let mediaType: 'image' | 'video' | undefined;

    try {
      if (contentType.includes('application/json')) {
        // JSON request with URL
        const data = await req.json();
        imageUrl = data.url;
        
        if (!imageUrl) {
          return errorResponse('Media URL is required', 400);
        }

        // Determine media type from URL extension
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
        const urlLower = imageUrl.toLowerCase();
        mediaType = videoExtensions.some(ext => urlLower.includes(ext)) ? 'video' : 'image';
      } else if (contentType.includes('multipart/form-data')) {
        // FormData request with file - handle upload directly
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
          return errorResponse('No file uploaded', 400);
        }

        // Validate file type (images and videos)
        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
        const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
        
        if (!allowedTypes.includes(file.type)) {
          return errorResponse('Invalid file type. Only images and videos are allowed.', 400);
        }

        // Determine file type
        const isVideo = allowedVideoTypes.includes(file.type);
        mediaType = isVideo ? 'video' : 'image';
        
        // Validate file size (max 50MB for videos, 5MB for images)
        const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for videos, 5MB for images
        if (file.size > maxSize) {
          return errorResponse(`File size exceeds ${isVideo ? '50MB' : '5MB'} limit`, 400);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const extension = path.extname(file.name);
        const filename = `${timestamp}-${randomString}${extension}`;
        
        const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
        const filepath = path.join(UPLOAD_DIR, filename);

        // Ensure directory exists
        if (!existsSync(UPLOAD_DIR)) {
          await mkdir(UPLOAD_DIR, { recursive: true });
        }

        // Convert file to buffer and save
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // Return relative URL path
        imageUrl = `/uploads/${filename}`;
      } else {
        return errorResponse('Invalid content type', 400);
      }
    } catch (error: any) {
      console.error('Error processing media:', error);
      return errorResponse(error.message || 'Failed to process media', 500);
    }

    const images = product.images || [];
    const maxOrder = images.length > 0 
      ? Math.max(...images.map(img => img.order || 0))
      : -1;

    // If URL is relative, make it absolute
    const finalUrl = imageUrl.startsWith('http') || imageUrl.startsWith('/')
      ? imageUrl
      : `/${imageUrl}`;

    const newImage: ProductImage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: finalUrl,
      type: mediaType,
      order: maxOrder + 1,
      productId: params.id,
      createdAt: new Date().toISOString(),
    };

    const updatedImages = [...images, newImage];
    const updatedProduct = update<Product>('products', params.id, {
      images: updatedImages,
      updatedAt: new Date().toISOString(),
    });

    return successResponse(newImage, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return errorResponse(error.message, 403);
    }
    console.error('Add product image error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

