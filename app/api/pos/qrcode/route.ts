import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { authenticate, requireRole } from '@/middleware/auth';
import { getByIdAsync, getAllAsync } from '@/lib/db';
import { Product } from '@/types';

/**
 * GET /api/pos/qrcode/:productId
 * Generate QR code for a product
 * QR code contains product ID and name for quick scanning
 */
export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Only CASHIER+ can access QR codes
    if (!user || !['CASHIER', 'ADMIN', 'SUPERADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const productId = url.searchParams.get('productId');
    const format = url.searchParams.get('format') || 'image'; // image | json

    if (!productId) {
      return NextResponse.json(
        { success: false, message: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Get product to verify it exists
    const product = await getByIdAsync<Product>('products', productId as string);
    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    // QR code data includes product ID and name for easy identification
    const qrData = JSON.stringify({
      type: 'PRODUCT',
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      timestamp: new Date().toISOString(),
    });

    if (format === 'json') {
      // Return QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          productId,
          productName: product.name,
          sku: product.sku,
          qrCode: qrDataUrl,
          qrData: qrData,
        },
      });
    }

    // Return QR code as PNG image
    const qrImage = await QRCode.toBuffer(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    const response = new NextResponse(new Uint8Array(qrImage));
    response.headers.set('Content-Type', 'image/png');
    response.headers.set(
      'Content-Disposition',
      `inline; filename="${productId}-qr.png"`
    );
    return response;
  } catch (error) {
    console.error('QR code generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pos/qrcode/scan
 * Handle barcode scanner input (product ID or SKU)
 * Returns product details for quick add to cart
 */
export async function POST(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    if (!['CASHIER', 'ADMIN', 'SUPERADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { barcode, type = 'auto' } = body;

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: 'Barcode is required' },
        { status: 400 }
      );
    }

    let product: Product | null = null;

    // Try to parse as QR code data
    try {
      const qrData = JSON.parse(barcode);
      if (qrData.type === 'PRODUCT' && qrData.productId) {
        product = await getByIdAsync<Product>('products', qrData.productId);
      }
    } catch {
      // Not JSON, try as product ID or SKU
    }

    // If not found, try as product ID
    if (!product) {
      product = await getByIdAsync<Product>('products', barcode);
    }

    // If still not found, try as SKU
    if (!product) {
      const products = await getAllAsync<Product>('products');
      product = products?.find((p) => p.sku === barcode) || null;
    }

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found for barcode: ' + barcode },
        { status: 404 }
      );
    }

    // Check if product is available for POS
    if (product.active_for_pos === false || (product.stock !== undefined && product.stock <= 0)) {
      return NextResponse.json(
        { success: false, message: 'Product not available for POS' },
        { status: 409 }
      );
    }

    const price = product.offline_price ?? product.price;

    return NextResponse.json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        price,
        stock: product.stock ?? 0,
        sku: product.sku,
        categoryId: product.categoryId,
        offline_price: product.offline_price,
      },
      message: 'Product found via barcode scan',
    });
  } catch (error) {
    console.error('Barcode scan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process barcode' },
      { status: 500 }
    );
  }
}
