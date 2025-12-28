import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001'; // URL where bot is running

/**
 * Send notification to Telegram user by phone number
 */
export async function sendTelegramNotificationByPhone(phone: string, message: string): Promise<boolean> {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('TELEGRAM_BOT_TOKEN is not set, skipping Telegram notification');
      return false;
    }

    // Get telegramUserId by phone
    const userResponse = await axios.get(`${API_URL}/telegram/user-by-phone?phone=${encodeURIComponent(phone)}`);
    const telegramUserId = userResponse.data.data?.telegramUserId;

    if (!telegramUserId) {
      console.log(`[TELEGRAM] No telegramUserId found for phone ${phone}, skipping notification`);
      return false;
    }

    // Send notification via bot API
    const botResponse = await axios.post(`${API_URL}/telegram/send-notification`, {
      telegramUserId,
      message,
    });

    return botResponse.data.success === true;
  } catch (error: any) {
    console.error('[TELEGRAM] Error sending notification:', error);
    return false;
  }
}

