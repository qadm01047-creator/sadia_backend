import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Send notification via Telegram Bot API
export async function POST(req: NextRequest) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return errorResponse('TELEGRAM_BOT_TOKEN is not configured', 500);
    }

    const { telegramUserId, message } = await req.json();

    if (!telegramUserId || !message) {
      return errorResponse('telegramUserId and message are required', 400);
    }

    // Send message via Telegram Bot API
    const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: telegramUserId,
      text: message,
      parse_mode: 'Markdown',
    });

    return successResponse({ success: true, messageId: response.data.result.message_id });
  } catch (error: any) {
    console.error('Error sending Telegram notification:', error);
    
    // Если пользователь не найден или бот заблокирован, это не критическая ошибка
    if (error.response?.status === 400 || error.response?.status === 403) {
      return successResponse({ success: false, error: 'User not found or bot blocked' });
    }

    return errorResponse(error.message || 'Internal server error', 500);
  }
}

