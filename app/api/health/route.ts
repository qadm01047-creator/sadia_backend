import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  return successResponse({ status: 'ok', timestamp: new Date().toISOString() });
}

