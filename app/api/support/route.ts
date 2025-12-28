import { NextRequest } from 'next/server';
import { create } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { SupportMessage } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { email, message } = data;

    if (!email || !message) {
      return errorResponse('Email and message are required', 400);
    }

    const supportMessage = create<SupportMessage>('supportMessages', {
      email,
      message,
      responded: false,
      createdAt: new Date().toISOString(),
    });

    return successResponse(supportMessage, 201);
  } catch (error: any) {
    console.error('Create support message error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

