import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const origin = request.headers.get('origin');
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Production: only allow https://sadia-lux.vercel.app/
    // Development: allow localhost origins
    const allowedOrigins = isDevelopment
      ? [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://localhost:5174',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5174',
        ]
      : ['https://sadia-lux.vercel.app'];

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      
      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      } else if (!origin && isDevelopment) {
        // Allow requests without origin in development (like Postman)
        response.headers.set('Access-Control-Allow-Origin', '*');
      } else {
        // Reject CORS in production for non-allowed origins
        return new NextResponse(
          JSON.stringify({ error: 'CORS policy: Origin not allowed' }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, PATCH'
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      response.headers.set('Access-Control-Max-Age', '86400');
      
      return response;
    }

    // Handle actual requests
    const response = NextResponse.next();
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    } else if (!origin && isDevelopment) {
      // Allow requests without origin in development (like Postman)
      response.headers.set('Access-Control-Allow-Origin', '*');
    } else if (origin && !allowedOrigins.includes(origin)) {
      // Reject CORS in production for non-allowed origins
      return new NextResponse(
        JSON.stringify({ error: 'CORS policy: Origin not allowed' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    );
    response.headers.set('Access-Control-Max-Age', '86400');

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};


