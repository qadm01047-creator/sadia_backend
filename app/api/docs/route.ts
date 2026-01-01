import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/swagger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Ensure the spec is valid
    const spec = swaggerSpec || {};
    
    // Add CORS headers for Swagger UI
    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error: any) {
    console.error('Error generating Swagger spec:', error);
    return NextResponse.json(
      { error: 'Failed to generate API documentation', message: error.message },
      { status: 500 }
    );
  }
}

