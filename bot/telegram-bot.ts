// @ts-ignore - node-telegram-bot-api types may not be available
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7996833914:AAGuJt600Y7NE8DaDWDmnq18bh3UDgu7jhQ';
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  categoryId?: string;
  images?: Array<{ url: string }>;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CartItem {
  productId: string;
  productName: string;
  size?: string;
  quantity: number;
  price: number;
}

interface TelegramUser {
  telegramUserId: string;
  userId?: string;
  role?: string;
}

class SadiaTelegramBot {
  private bot: TelegramBot;
  private userCarts: Map<number, CartItem[]>;
  private userStates: Map<number, string>;
  private userRoles: Map<number, string>;
  private categoryMapping: Map<string, string> = new Map();
  private userProductLists: Map<number, Product[]> = new Map(); // Список товаров для каждого пользователя
  private userCurrentProductIndex: Map<number, number> = new Map(); // Текущий индекс товара
  private userPendingOrder: Map<number, { productId: string; size?: string }> = new Map(); // Товар ожидающий количества
  private userCoupon: Map<number, { code: string; discount: number; discountType: string }> = new Map(); // Купон пользователя
  private userOrderLists: Map<number, any[]> = new Map(); // Список заказов для каждого пользователя
  private userCurrentOrderIndex: Map<number, number> = new Map(); // Текущий индекс просматриваемого заказа

  constructor() {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    // Создаем бота с polling для автоматического получения обновлений
    this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    this.userCarts = new Map();
    this.userStates = new Map();
    this.userRoles = new Map();
    this.userProductLists = new Map();
    this.userCurrentProductIndex = new Map();
    this.userPendingOrder = new Map();
    this.userCoupon = new Map();
    this.userOrderLists = new Map();
    this.userCurrentOrderIndex = new Map();

    // ВАЖНО: setupCallbacks должен быть ПЕРЕД setupCommands,
    // чтобы callback queries обрабатывались до текстовых сообщений
    this.setupCallbacks();
    this.setupCommands();
  }

  private async getUserRole(telegramUserId: number): Promise<string> {
    // Check cache first
    if (this.userRoles.has(telegramUserId)) {
      return this.userRoles.get(telegramUserId) || 'USER';
    }

    try {
      // Try to get user role from API
      const response = await axios.get(`${API_URL}/telegram/user?telegramUserId=${telegramUserId}`);
      const userData = response.data.data;
      
      const role = userData?.role || 'USER';
      this.userRoles.set(telegramUserId, role);
      return role;
    } catch (error) {
      console.error('Error fetching user role:', error);
      // Default to USER if API fails
      const role = 'USER';
      this.userRoles.set(telegramUserId, role);
      return role;
    }
  }

  private async isAdmin(telegramUserId: number): Promise<boolean> {
    const role = await this.getUserRole(telegramUserId);
    return role === 'ADMIN' || role === 'SUPERADMIN';
  }

  private setupCommands() {
    // Start command
    this.bot.onText(/\/start/, async (msg: any) => {
      const chatId = msg.chat.id;
      const isAdmin = await this.isAdmin(chatId);
      
        this.userCarts.set(chatId, []);
        this.userStates.delete(chatId);
        this.userCoupon.delete(chatId);
        this.userOrderLists.delete(chatId);
        this.userCurrentOrderIndex.delete(chatId);

        await this.sendMainMenu(chatId, isAdmin);
    });

    // Обработка текстовых команд из меню
    this.bot.on('message', async (msg: any) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      // Пропускаем команды, они обрабатываются onText
      if (text && text.startsWith('/')) {
        return;
      }

      // Обработка текстовых кнопок из меню
      if (text === '🛍️ Каталог') {
        await this.showCategories(chatId);
      } else if (text === '◀️ Главное меню' || text === '🏠 Главное меню') {
        const isAdmin = await this.isAdmin(chatId);
        this.userStates.delete(chatId);
        this.userPendingOrder.delete(chatId);
        await this.sendMainMenu(chatId, isAdmin);
      } else if (this.categoryMapping.has(text)) {
        // Пользователь выбрал категорию из постоянного меню
        const categoryId = this.categoryMapping.get(text)!;
        console.log(`[BOT] Category selected via menu: ${text} -> ${categoryId}`);
        await this.showProducts(chatId, categoryId);
      } else if (text === '◀️ Назад') {
        // Назад к предыдущему товару
        const currentIndex = this.userCurrentProductIndex.get(chatId) || 0;
        if (currentIndex > 0) {
          await this.showProductAtIndex(chatId, currentIndex - 1);
        } else {
          await this.bot.sendMessage(chatId, '⚠️ Это первый товар в категории');
        }
      } else if (text === 'Вперед ▶️') {
        // Следующий товар
        const products = this.userProductLists.get(chatId) || [];
        const currentIndex = this.userCurrentProductIndex.get(chatId) || 0;
        if (currentIndex < products.length - 1) {
          await this.showProductAtIndex(chatId, currentIndex + 1);
        }
      } else if (text === '◀️ Вернуться назад') {
        // Вернуться к категориям
        await this.showCategories(chatId);
      } else if (text === '🛒 Заказать') {
        // Заказ товара - сначала выбор размера
        const products = this.userProductLists.get(chatId) || [];
        const currentIndex = this.userCurrentProductIndex.get(chatId) || 0;
        if (products.length === 0 || currentIndex >= products.length) {
          await this.bot.sendMessage(chatId, '❌ Товар не найден');
          return;
        }
        const product = products[currentIndex];
        
        // Получаем инвентарь для выбора размера
        const inventoryResponse = await axios.get(`${API_URL}/telegram/inventory?productId=${product.id}`);
        const inventory = inventoryResponse.data.data || [];
        const availableSizes = inventory.filter((inv: any) => inv.quantity > 0);

        if (availableSizes.length === 0) {
          await this.bot.sendMessage(chatId, '❌ Товар временно недоступен');
          return;
        }

        if (availableSizes.length === 1) {
          // Если только один размер, выбираем его автоматически
          const size = availableSizes[0].size;
          this.userStates.set(chatId, 'waiting_quantity');
          this.userPendingOrder.set(chatId, { productId: product.id, size });
          await this.bot.sendMessage(
            chatId,
            '📝 Укажите количество товара:',
            {
              reply_markup: {
                keyboard: [
                  [{ text: '1' }],
                  [{ text: '❌ Отмена' }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
        } else {
          // Если несколько размеров, просим выбрать
          this.userStates.set(chatId, 'selecting_size');
          await this.selectSizeForOrder(chatId, product.id);
        }
      } else if (text === '❌ Отмена') {
        // Отмена заказа
        this.userStates.delete(chatId);
        this.userPendingOrder.delete(chatId);
        const currentIndex = this.userCurrentProductIndex.get(chatId) || 0;
        await this.showProductAtIndex(chatId, currentIndex);
      } else if (this.userStates.get(chatId) === 'waiting_quantity') {
        // Пользователь ввел количество (кнопка "1" или любое число)
        if (text === '1' || !isNaN(parseInt(text))) {
          const quantity = parseInt(text) || 1;
          if (quantity <= 0) {
            await this.bot.sendMessage(chatId, '❌ Пожалуйста, введите число больше 0');
            return;
          }

          const pendingOrder = this.userPendingOrder.get(chatId);
          if (!pendingOrder || !pendingOrder.productId || !pendingOrder.size) {
            await this.bot.sendMessage(chatId, '❌ Ошибка при обработке заказа');
            this.userStates.delete(chatId);
            this.userPendingOrder.delete(chatId);
            return;
          }

          // Сохраняем количество и переходим к оформлению
          this.userPendingOrder.set(chatId, { 
            ...pendingOrder, 
            quantity 
          });
          this.userStates.set(chatId, 'ready_to_checkout');
          
          // Получаем информацию о товаре
          const productResponse = await axios.get(`${API_URL}/products/${pendingOrder.productId}`);
          const product = productResponse.data.data;
          const totalPrice = product.price * quantity;

          await this.bot.sendMessage(
            chatId,
            `✅ Товар добавлен!\n\n` +
            `📦 Товар: ${product.name}\n` +
            `📏 Размер: ${pendingOrder.size}\n` +
            `🔢 Количество: ${quantity}\n` +
            `💰 Цена: ${product.price.toFixed(2)} сум × ${quantity} = ${totalPrice.toFixed(2)} сум`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: '✅ Оформить заказ' }],
                  [{ text: '❌ Отмена' }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
        } else if (text === '❌ Отмена') {
          // Отмена заказа
          this.userStates.delete(chatId);
          this.userPendingOrder.delete(chatId);
          this.sizeMapping.clear();
          const currentIndex = this.userCurrentProductIndex.get(chatId) || 0;
          await this.showProductAtIndex(chatId, currentIndex);
        }
      } else if (this.userStates.get(chatId) === 'selecting_size') {
        // Пользователь выбирает размер из ReplyKeyboard
        const pendingOrder = this.userPendingOrder.get(chatId);
        if (!pendingOrder || !pendingOrder.productId) {
          await this.bot.sendMessage(chatId, '❌ Ошибка при обработке заказа');
          this.userStates.delete(chatId);
          this.userPendingOrder.delete(chatId);
          return;
        }

        if (text === '❌ Отмена заказа' || text === '❌ Отмена') {
          // Отмена заказа
          this.userStates.delete(chatId);
          this.userPendingOrder.delete(chatId);
          this.sizeMapping.clear();
          const currentIndex = this.userCurrentProductIndex.get(chatId) || 0;
          await this.showProductAtIndex(chatId, currentIndex);
          return;
        }

        // Проверяем, является ли текст размером
        const sizeInfo = this.sizeMapping.get(text);
        if (sizeInfo) {
          // Размер выбран, переходим к количеству
          this.userPendingOrder.set(chatId, { 
            ...pendingOrder, 
            size: sizeInfo.size 
          });
          this.userStates.set(chatId, 'waiting_quantity');
          this.sizeMapping.clear();
          
          await this.bot.sendMessage(
            chatId,
            '📝 Укажите количество товара:',
            {
              reply_markup: {
                keyboard: [
                  [{ text: '1' }],
                  [{ text: '❌ Отмена' }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            }
          );
        } else {
          await this.bot.sendMessage(chatId, '❌ Пожалуйста, выберите размер из меню ниже');
        }
      } else if (text === '✅ Оформить заказ') {
        // Добавляем товар в корзину и показываем платежные системы
        const pendingOrder = this.userPendingOrder.get(chatId);
        if (!pendingOrder || !pendingOrder.productId || !pendingOrder.size || !pendingOrder.quantity) {
          await this.bot.sendMessage(chatId, '❌ Ошибка при обработке заказа');
          this.userStates.delete(chatId);
          this.userPendingOrder.delete(chatId);
          return;
        }

        // Добавляем товар в корзину
        await this.addToCartWithQuantity(
          chatId, 
          pendingOrder.productId, 
          pendingOrder.size, 
          pendingOrder.quantity
        );
        // Показываем платежные системы
        await this.checkout(chatId);
      } else if (this.userStates.get(chatId) === 'selecting_payment') {
        // Выбор платежной системы
        if (text === '💳 Payme') {
          await this.checkout(chatId, 'PAYME');
        } else if (text === '💳 Click') {
          await this.checkout(chatId, 'CLICK');
        } else if (text === '❌ Отмена') {
          this.userStates.delete(chatId);
          const isAdmin = await this.isAdmin(chatId);
          await this.sendMainMenu(chatId, isAdmin);
        } else {
          await this.bot.sendMessage(chatId, '❌ Пожалуйста, выберите способ оплаты из меню');
        }
      } else if (text === '🛒 Корзина') {
        await this.showCart(chatId);
      } else if (text === '🌐 Открыть сайт') {
        const frontendUrl = FRONTEND_URL || 'http://localhost:5173';
        // Telegram требует HTTPS для Web App, поэтому просто отправляем URL
        await this.bot.sendMessage(
          chatId,
          `🌐 Откройте сайт в браузере:\n\n${frontendUrl}\n\nИли используйте веб-версию Telegram для открытия Mini App.`,
        );
      } else if (text === '⚙️ Админ панель') {
        const isAdmin = await this.isAdmin(chatId);
        if (isAdmin) {
          await this.showAdminPanel(chatId);
        } else {
          await this.bot.sendMessage(chatId, '❌ У вас нет доступа к админ панели');
        }
      } else if (text === 'ℹ️ Помощь') {
        await this.bot.sendMessage(
          chatId,
          `🛍️ *Sadia.lux - Бот магазина*\n\n` +
          `*Команды:*\n` +
          `/start - Главное меню\n` +
          `/catalog - Каталог товаров\n` +
          `/cart - Корзина\n` +
          `/help - Помощь\n\n` +
          `Используйте кнопки меню или команды для навигации!`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // Catalog command
    this.bot.onText(/\/catalog|\/catalog$/, async (msg: any) => {
      const chatId = msg.chat.id;
      await this.showCategories(chatId);
    });

    // Cart command
    this.bot.onText(/\/cart|\/cart$/, async (msg: any) => {
      const chatId = msg.chat.id;
      await this.showCart(chatId);
    });

    // Help command
    this.bot.onText(/\/help/, async (msg: any) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(
        chatId,
        `🛍️ *Sadia.lux - Бот магазина*\n\n` +
        `*Команды:*\n` +
        `/start - Главное меню\n` +
        `/catalog - Каталог товаров\n` +
        `/cart - Корзина\n` +
        `/help - Помощь\n\n` +
        `Вы можете просматривать товары, добавлять их в корзину и оформлять заказы прямо здесь!`,
        { parse_mode: 'Markdown' }
      );
    });
  }

  private setupCallbacks() {
    // Handle all callback queries
    // ВАЖНО: этот обработчик должен быть зарегистрирован ПЕРВЫМ
    this.bot.on('callback_query', async (query: any) => {
      try {
        const chatId = query.message?.chat.id;
        const data = query.data;

        console.log(`[BOT] ===== CALLBACK QUERY RECEIVED =====`);
        console.log(`[BOT] Chat ID: ${chatId}`);
        console.log(`[BOT] Callback data: ${data}`);
        console.log(`[BOT] Full query:`, JSON.stringify(query, null, 2));

        if (!chatId || !data) {
          console.log('[BOT] ❌ Missing chatId or data, ignoring callback');
          return;
        }

        // Отвечаем на callback query сразу, чтобы убрать "загрузку"
        await this.bot.answerCallbackQuery(query.id).catch((err: any) => {
          console.error('[BOT] Error answering callback query:', err);
        });

        if (data.startsWith('category_')) {
          const categoryId = data.replace('category_', '');
          console.log(`[BOT] ✅ Category selected: ${categoryId}`);
          await this.showProducts(chatId, categoryId);
        } else if (data.startsWith('product_nav_')) {
          // Навигация по товарам (назад/вперед)
          const targetIndex = parseInt(data.replace('product_nav_', ''));
          await this.showProductAtIndex(chatId, targetIndex);
        } else if (data.startsWith('product_order_')) {
          // Заказ товара
          const productId = data.replace('product_order_', '');
          this.userStates.set(chatId, `select_size_${productId}`);
          await this.selectSize(chatId, productId);
        } else if (data === 'back_to_categories') {
          // Вернуться к категориям
          await this.showCategories(chatId);
        } else if (data.startsWith('product_')) {
        const productId = data.replace('product_', '');
        await this.showProductDetails(chatId, productId);
      } else if (data.startsWith('add_to_cart_')) {
        const productId = data.replace('add_to_cart_', '');
        this.userStates.set(chatId, `select_size_${productId}`);
        await this.selectSize(chatId, productId);
      } else if (data.startsWith('size_order_')) {
        // Размер выбран для заказа с указанным количеством
        const [_, productId, size, quantity] = data.split('_');
        await this.addToCartWithQuantity(chatId, productId, size, parseInt(quantity));
      } else if (data === 'cancel_order') {
        // Отмена заказа (для обратной совместимости с inline кнопками)
        this.userStates.delete(chatId);
        this.userPendingOrder.delete(chatId);
        this.sizeMapping.clear();
        const currentIndex = this.userCurrentProductIndex.get(chatId) || 0;
        await this.showProductAtIndex(chatId, currentIndex);
      } else if (data.startsWith('size_')) {
        const [_, productId, size] = data.split('_');
        await this.addToCart(chatId, productId, size);
      } else if (data === 'view_cart') {
        await this.showUserOrders(chatId);
      } else if (data === 'clear_cart') {
        this.userCarts.set(chatId, []);
        await this.bot.sendMessage(chatId, '✅ Корзина очищена');
        const isAdmin = await this.isAdmin(chatId);
        await this.sendMainMenu(chatId, isAdmin);
      } else if (data === 'checkout') {
        await this.checkout(chatId);
      } else if (data === 'main_menu') {
        this.userStates.delete(chatId);
        const isAdmin = await this.isAdmin(chatId);
        await this.sendMainMenu(chatId, isAdmin);
      } else if (data === 'admin_panel') {
        const isAdmin = await this.isAdmin(chatId);
        if (isAdmin) {
          await this.showAdminPanel(chatId);
        } else {
          await this.bot.sendMessage(chatId, '❌ У вас нет доступа к админ панели');
        }
      } else if (data.startsWith('admin_')) {
        const isAdmin = await this.isAdmin(chatId);
        if (!isAdmin) {
          await this.bot.sendMessage(chatId, '❌ У вас нет доступа');
          return;
        }
        
        if (data === 'admin_orders') {
          await this.showAdminOrders(chatId);
        } else if (data === 'admin_products') {
          await this.showAdminProducts(chatId);
        } else if (data === 'admin_stats') {
          await this.showAdminStats(chatId);
        }
      } else if (data === 'catalog') {
        await this.showCategories(chatId);
      } else if (data === 'help') {
        await this.bot.sendMessage(
          chatId,
          `🛍️ *Sadia.lux - Бот магазина*\n\n` +
          `*Команды:*\n` +
          `/start - Главное меню\n` +
          `/catalog - Каталог товаров\n` +
          `/cart - Корзина\n` +
          `/help - Помощь\n\n` +
          `Вы можете просматривать товары, добавлять их в корзину и оформлять заказы прямо здесь!`,
          { parse_mode: 'Markdown' }
        );
        } else if (data.startsWith('remove_item_')) {
          const index = parseInt(data.replace('remove_item_', ''));
          await this.removeFromCart(chatId, index);
        } else {
          console.log(`[BOT] ⚠️ Unknown callback data: ${data}`);
        }
      } catch (error: any) {
        console.error('[BOT] ❌ ERROR in callback_query handler:', error);
        console.error('[BOT] Error message:', error.message);
        console.error('[BOT] Error stack:', error.stack);
        try {
          await this.bot.answerCallbackQuery(query.id, {
            text: 'Произошла ошибка. Попробуйте еще раз.',
            show_alert: false,
          }).catch(() => {});
        } catch (err) {
          // Ignore
        }
      }
    });
  }

  private async sendMainMenu(chatId: number, isAdmin: boolean = false) {
    const frontendUrl = FRONTEND_URL || 'http://localhost:5173';
    
    // Постоянное меню (ReplyKeyboardMarkup) - кнопки внизу экрана
    const replyKeyboard = {
      keyboard: [
        [{ text: '🛍️ Каталог' }, { text: '🛒 Корзина' }],
        [{ text: '🌐 Открыть сайт' }],
        ...(isAdmin ? [[{ text: '⚙️ Админ панель' }]] : []),
        [{ text: 'ℹ️ Помощь' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };

    await this.bot.sendMessage(
      chatId,
      `👋 *Добро пожаловать в Sadia.lux!*\n\n` +
      `Элегантная одежда для современной мусульманки.\n` +
      `Выберите действие с помощью кнопок ниже:`,
      { 
        parse_mode: 'Markdown', 
        reply_markup: replyKeyboard 
      }
    );
  }

  private async showCategories(chatId: number) {
    try {
      const response = await axios.get(`${API_URL}/categories`);
      const categories = response.data.data || [];

      if (categories.length === 0) {
        await this.bot.sendMessage(chatId, 'Категории не найдены');
        return;
      }

      // Используем ReplyKeyboardMarkup для постоянного меню внизу
      // Группируем категории по 2 кнопки в ряд
      const keyboardRows: any[][] = [];
      for (let i = 0; i < categories.length; i += 2) {
        const row = categories.slice(i, i + 2).map((cat: Category) => ({
          text: cat.name
        }));
        keyboardRows.push(row);
      }
      
      // Добавляем кнопку "Главное меню"
      keyboardRows.push([{ text: '◀️ Главное меню' }]);

      const replyKeyboard = {
        keyboard: keyboardRows,
        resize_keyboard: true,
        one_time_keyboard: false,
      };

      // Сохраняем mapping категорий для обработки текстовых сообщений
      this.categoryMapping = new Map();
      categories.forEach((cat: Category) => {
        this.categoryMapping.set(cat.name, cat.id);
      });

      await this.bot.sendMessage(
        chatId,
        '📂 *Выберите категорию из меню ниже:*',
        { 
          parse_mode: 'Markdown', 
          reply_markup: replyKeyboard 
        }
      );
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      console.error('API_URL:', API_URL);
      console.error('Full error:', error.response?.data || error.message);
      let errorMessage = 'Неизвестная ошибка';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Не удалось подключиться к бэкенд серверу. Убедитесь, что бэкенд запущен на http://localhost:3000';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      await this.bot.sendMessage(
        chatId,
        `❌ Ошибка при загрузке категорий\n\n${errorMessage}`
      );
    }
  }

  private async showProducts(chatId: number, categoryId: string) {
    try {
      console.log(`[BOT] Fetching products for category: ${categoryId}`);
      const url = `${API_URL}/products?categoryId=${categoryId}&limit=50`;
      console.log(`[BOT] API URL: ${url}`);
      
      const response = await axios.get(url);
      console.log(`[BOT] Products response status: ${response.status}`);
      console.log(`[BOT] Products response data structure:`, Object.keys(response.data));
      
      const products = response.data.data?.data || [];
      console.log(`[BOT] Found ${products.length} products`);

      if (products.length === 0) {
        await this.bot.sendMessage(chatId, '❌ Товары в этой категории не найдены');
        return;
      }

      // Сохраняем список товаров для пользователя
      this.userProductLists.set(chatId, products);
      this.userCurrentProductIndex.set(chatId, 0);

      // Показываем первый товар
      await this.showProductAtIndex(chatId, 0);
    } catch (error: any) {
      console.error('[BOT] Error fetching products:', error);
      console.error('[BOT] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      let errorMessage = 'Неизвестная ошибка';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Не удалось подключиться к бэкенд серверу';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      await this.bot.sendMessage(
        chatId,
        `❌ Ошибка при загрузке товаров\n\n${errorMessage}`
      );
    }
  }

  private async showProductAtIndex(chatId: number, index: number) {
    try {
      const products = this.userProductLists.get(chatId) || [];
      if (products.length === 0 || index < 0 || index >= products.length) {
        await this.bot.sendMessage(chatId, '❌ Товар не найден');
        return;
      }

      const product = products[index];
      this.userCurrentProductIndex.set(chatId, index);

      // Получаем детали товара с категорией и изображениями
      const productResponse = await axios.get(`${API_URL}/products/${product.id}`);
      const fullProduct = productResponse.data.data;

      // Получаем инвентарь для проверки количества
      const inventoryResponse = await axios.get(`${API_URL}/telegram/inventory?productId=${product.id}`);
      const inventory = inventoryResponse.data.data || [];
      const totalQuantity = inventory.reduce((sum: number, inv: any) => sum + inv.quantity, 0);

      // Получаем информацию о категории
      const categoryName = fullProduct.category?.name || 'Без категории';

      // Формируем сообщение с информацией о товаре
      let message = `📦 *${fullProduct.name}*\n\n`;
      message += `📂 Категория: ${categoryName}\n`;
      message += `💰 Цена: *${fullProduct.price.toFixed(2)} сум*\n`;
      
      if (fullProduct.description) {
        message += `\n📝 ${fullProduct.description}\n`;
      }

      message += `\n📊 Количество на складе: *${totalQuantity} шт.*\n`;

      if (inventory.length > 0) {
        message += `\n📏 Доступные размеры:\n`;
        inventory.forEach((inv: any) => {
          if (inv.quantity > 0) {
            message += `  • ${inv.size}: ${inv.quantity} шт.\n`;
          }
        });
      }

      message += `\n${index + 1} из ${products.length}`;

      // Кнопки навигации (ReplyKeyboard - Telegram API не поддерживает reply_markup в sendMediaGroup)
      const keyboardRows: any[][] = [];
      
      // Первая строка: Навигация (Назад всегда видимая, Вперед если не последний)
      const navButtons = [];
      navButtons.push({ text: '◀️ Назад' }); // Всегда показываем
      if (index < products.length - 1) {
        navButtons.push({ text: 'Вперед ▶️' });
      }
      keyboardRows.push(navButtons);
      
      // Вторая строка: Заказать
      keyboardRows.push([{ text: '🛒 Заказать' }]);
      
      // Третья строка: Вернуться назад (к категориям)
      keyboardRows.push([{ text: '◀️ Вернуться назад' }]);

      const replyKeyboard = {
        keyboard: keyboardRows,
        resize_keyboard: true,
        one_time_keyboard: false,
      };

      // Отправляем все медиа товара (фото и видео) в одном сообщении через sendMediaGroup
      if (fullProduct.images && fullProduct.images.length > 0) {
        const allMedia = fullProduct.images;
        const mediaGroup: any[] = [];
        
        // Подготавливаем все медиа файлы
        for (let i = 0; i < allMedia.length; i++) {
          const mediaItem = allMedia[i];
          const isLast = i === allMedia.length - 1;
          
          let mediaUrl = mediaItem.url;
          if (!mediaUrl.startsWith('http')) {
            mediaUrl = `${API_URL.replace('/api', '')}${mediaUrl.startsWith('/') ? mediaUrl : '/' + mediaUrl}`;
          }
          
          try {
            if (mediaItem.type === 'video') {
              if (mediaUrl.startsWith('https://')) {
                // Последнему элементу добавляем caption
                const mediaObj: any = { type: 'video', media: mediaUrl };
                if (isLast) {
                  mediaObj.caption = message;
                  mediaObj.parse_mode = 'Markdown';
                }
                mediaGroup.push(mediaObj);
              } else {
                // Для HTTP скачиваем видео
                const videoResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
                const videoBuffer = Buffer.from(videoResponse.data);
                const mediaObj: any = { type: 'video', media: videoBuffer };
                if (isLast) {
                  mediaObj.caption = message;
                  mediaObj.parse_mode = 'Markdown';
                }
                mediaGroup.push(mediaObj);
              }
            } else {
              // Фото
              if (mediaUrl.startsWith('https://')) {
                const mediaObj: any = { type: 'photo', media: mediaUrl };
                if (isLast) {
                  mediaObj.caption = message;
                  mediaObj.parse_mode = 'Markdown';
                }
                mediaGroup.push(mediaObj);
              } else {
                // Для HTTP скачиваем изображение
                const imageResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(imageResponse.data);
                const mediaObj: any = { type: 'photo', media: imageBuffer };
                if (isLast) {
                  mediaObj.caption = message;
                  mediaObj.parse_mode = 'Markdown';
                }
                mediaGroup.push(mediaObj);
              }
            }
          } catch (error) {
            console.error('Error loading media:', error);
          }
        }
        
        // Отправляем все медиа в одном сообщении
        if (mediaGroup.length > 0) {
          try {
            // Отправляем медиа группу (caption добавлен к последнему элементу)
            await this.bot.sendMediaGroup(chatId, mediaGroup);
            // Устанавливаем кнопки навигации через отдельное сообщение с минимальным текстом
            // Это необходимо, так как Telegram API не позволяет добавить ReplyKeyboard к медиа-группе
            await this.bot.sendMessage(chatId, '↪️', {
              reply_markup: replyKeyboard,
            });
            return; // Всегда выходим после успешной отправки медиа-группы
          } catch (error) {
            console.error('Error sending media group:', error);
            // Fallback: если не получилось отправить группой, отправляем только последнее медиа с кнопками
            if (allMedia.length > 0) {
              const lastMedia = allMedia[allMedia.length - 1];
              let lastMediaUrl = lastMedia.url;
              if (!lastMediaUrl.startsWith('http')) {
                lastMediaUrl = `${API_URL.replace('/api', '')}${lastMediaUrl.startsWith('/') ? lastMediaUrl : '/' + lastMediaUrl}`;
              }
              
              try {
                if (lastMedia.type === 'video') {
                  if (lastMediaUrl.startsWith('https://')) {
                    await this.bot.sendVideo(chatId, lastMediaUrl, {
                      caption: message,
                      parse_mode: 'Markdown',
                      reply_markup: replyKeyboard,
                    });
                  } else {
                    const videoResponse = await axios.get(lastMediaUrl, { responseType: 'arraybuffer' });
                    const videoBuffer = Buffer.from(videoResponse.data);
                    await this.bot.sendVideo(chatId, videoBuffer, {
                      caption: message,
                      parse_mode: 'Markdown',
                      reply_markup: replyKeyboard,
                    });
                  }
                } else {
                  if (lastMediaUrl.startsWith('https://')) {
                    await this.bot.sendPhoto(chatId, lastMediaUrl, {
                      caption: message,
                      parse_mode: 'Markdown',
                      reply_markup: replyKeyboard,
                    });
                  } else {
                    const imageResponse = await axios.get(lastMediaUrl, { responseType: 'arraybuffer' });
                    const imageBuffer = Buffer.from(imageResponse.data);
                    await this.bot.sendPhoto(chatId, imageBuffer, {
                      caption: message,
                      parse_mode: 'Markdown',
                      reply_markup: replyKeyboard,
                    });
                  }
                }
                return;
              } catch (fallbackError) {
                console.error('Error in fallback:', fallbackError);
              }
            }
            
            // Если fallback тоже не сработал, отправляем только текст с кнопками
            await this.bot.sendMessage(chatId, message, {
              parse_mode: 'Markdown',
              reply_markup: replyKeyboard,
            });
            return;
          }
        }
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: replyKeyboard,
      });
    } catch (error: any) {
      console.error('[BOT] Error showing product:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при загрузке товара');
    }
  }

  private async showProductDetails(chatId: number, productId: string) {
    try {
      const response = await axios.get(`${API_URL}/products/${productId}`);
      const product = response.data.data;

      if (!product) {
        await this.bot.sendMessage(chatId, 'Товар не найден');
        return;
      }

      // Get inventory to check available sizes
      const inventoryResponse = await axios.get(`${API_URL}/telegram/inventory?productId=${productId}`);
      const inventory = inventoryResponse.data.data || [];
      const availableSizes = inventory
        .filter((inv: any) => inv.quantity > 0)
        .map((inv: any) => inv.size);

      let message = `*${product.name}*\n\n`;
      if (product.description) {
        message += `${product.description}\n\n`;
      }
      message += `💰 Цена: *${product.price.toFixed(2)} сум*\n`;

      if (availableSizes.length > 0) {
        message += `📏 Доступные размеры: ${availableSizes.join(', ')}\n`;
      }

      const keyboard: any = {
        inline_keyboard: [],
      };

      if (availableSizes.length > 0) {
        keyboard.inline_keyboard.push([
          { text: '🛒 Добавить в корзину', callback_data: `add_to_cart_${productId}` },
        ]);
      } else {
        message += `\n⚠️ Товар временно недоступен`;
      }

      keyboard.inline_keyboard.push([{ text: '◀️ Назад к каталогу', callback_data: 'catalog' }]);

      // Send product image/video if available
      if (product.images && product.images.length > 0) {
        // Ищем видео первым, если есть
        const video = product.images.find((img: any) => img.type === 'video');
        const photo = product.images.find((img: any) => img.type !== 'video') || product.images[0];
        const mediaToSend = video || photo;

        let mediaUrl = mediaToSend.url;
        if (!mediaUrl.startsWith('http')) {
          const baseUrl = API_URL.replace('/api', '');
          mediaUrl = `${baseUrl}${mediaUrl.startsWith('/') ? mediaUrl : '/' + mediaUrl}`;
        }

        try {
          if (video) {
            // Отправляем видео
            if (mediaUrl.startsWith('https://')) {
              await this.bot.sendVideo(chatId, mediaUrl, {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard,
              });
            } else {
              // Для HTTP скачиваем видео и отправляем как Buffer
              const videoResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
              const videoBuffer = Buffer.from(videoResponse.data);
              await this.bot.sendVideo(chatId, videoBuffer, {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard,
              });
            }
            return;
          } else {
            // Отправляем фото
            if (mediaUrl.startsWith('https://')) {
              await this.bot.sendPhoto(chatId, mediaUrl, {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard,
              });
            } else {
              // Для HTTP скачиваем изображение и отправляем как Buffer
              const imageResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
              const imageBuffer = Buffer.from(imageResponse.data);
              await this.bot.sendPhoto(chatId, imageBuffer, {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard,
              });
            }
            return;
          }
        } catch (error) {
          console.error('Error sending media:', error);
          // Fall through to send text message if media fails
        }
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error('Error fetching product:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при загрузке товара');
    }
  }

  private async selectSizeForOrder(chatId: number, productId: string) {
    try {
      const inventoryResponse = await axios.get(`${API_URL}/telegram/inventory?productId=${productId}`);
      const inventory = inventoryResponse.data.data || [];
      const availableSizes = inventory.filter((inv: any) => inv.quantity > 0);

      if (availableSizes.length === 0) {
        await this.bot.sendMessage(chatId, '❌ Размеры недоступны');
        return;
      }

      // Используем ReplyKeyboard для размеров (кнопки внизу)
      const keyboardRows: any[][] = [];
      
      // Группируем размеры по 2 в ряд
      for (let i = 0; i < availableSizes.length; i += 2) {
        const row = availableSizes.slice(i, i + 2).map((inv: any) => ({
          text: `Размер ${inv.size} (${inv.quantity} шт.)`
        }));
        keyboardRows.push(row);
      }
      
      // Добавляем кнопку отмены
      keyboardRows.push([{ text: '❌ Отмена заказа' }]);

      const replyKeyboard = {
        keyboard: keyboardRows,
        resize_keyboard: true,
        one_time_keyboard: false,
      };

      // Сохраняем mapping размеров для обработки текстовых сообщений
      const sizeMapping = new Map();
      availableSizes.forEach((inv: any) => {
        sizeMapping.set(`Размер ${inv.size} (${inv.quantity} шт.)`, { size: inv.size, quantity: inv.quantity });
      });
      // Также сохраняем просто размер без количества для удобства
      availableSizes.forEach((inv: any) => {
        sizeMapping.set(inv.size, { size: inv.size, quantity: inv.quantity });
      });
      this.sizeMapping = sizeMapping;
      this.userPendingOrder.set(chatId, { productId });

      await this.bot.sendMessage(chatId, `📏 Выберите размер из меню ниже:`, { 
        reply_markup: replyKeyboard 
      });
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при загрузке размеров');
    }
  }

  private async addToCartWithQuantity(chatId: number, productId: string, size: string, quantity: number) {
    try {
      const response = await axios.get(`${API_URL}/products/${productId}`);
      const product = response.data.data;

      if (!product) {
        await this.bot.sendMessage(chatId, '❌ Товар не найден');
        return;
      }

      const cart = this.userCarts.get(chatId) || [];
      const existingItemIndex = cart.findIndex(
        (item) => item.productId === productId && item.size === size
      );

      if (existingItemIndex >= 0) {
        cart[existingItemIndex].quantity += quantity;
      } else {
        cart.push({
          productId: product.id,
          productName: product.name,
          size,
          quantity,
          price: product.price,
        });
      }

      this.userCarts.set(chatId, cart);
      this.sizeMapping.clear();
      
      // Сообщение не отправляем здесь, оно отправляется в waiting_quantity или checkout
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при добавлении товара');
    }
  }

  private async selectSize(chatId: number, productId: string) {
    try {
      const inventoryResponse = await axios.get(`${API_URL}/telegram/inventory?productId=${productId}`);
      const inventory = inventoryResponse.data.data || [];
      const availableSizes = inventory.filter((inv: any) => inv.quantity > 0);

      if (availableSizes.length === 0) {
        await this.bot.sendMessage(chatId, '❌ Размеры недоступны');
        return;
      }

      const keyboard = {
        inline_keyboard: [
          ...availableSizes.map((inv: any) => [
            { text: `Размер ${inv.size} (${inv.quantity} шт.)`, callback_data: `size_${productId}_${inv.size}` },
          ]),
          [{ text: '◀️ Отмена', callback_data: `product_${productId}` }],
        ],
      };

      await this.bot.sendMessage(chatId, '📏 Выберите размер:', { reply_markup: keyboard });
    } catch (error) {
      console.error('Error fetching inventory:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при загрузке размеров');
    }
  }

  private async addToCart(chatId: number, productId: string, size: string) {
    try {
      const response = await axios.get(`${API_URL}/products/${productId}`);
      const product = response.data.data;

      if (!product) {
        await this.bot.sendMessage(chatId, '❌ Товар не найден');
        return;
      }

      const cart = this.userCarts.get(chatId) || [];
      const existingItemIndex = cart.findIndex(
        (item) => item.productId === productId && item.size === size
      );

      if (existingItemIndex >= 0) {
        cart[existingItemIndex].quantity += 1;
      } else {
        cart.push({
          productId: product.id,
          productName: product.name,
          size,
          quantity: 1,
          price: product.price,
        });
      }

      this.userCarts.set(chatId, cart);
      this.userStates.delete(chatId);

      await this.bot.sendMessage(chatId, '✅ Товар добавлен в корзину!');
      await this.showCart(chatId);
    } catch (error) {
      console.error('Error adding to cart:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при добавлении товара');
    }
  }

  private async showCart(chatId: number) {
    const cart = this.userCarts.get(chatId) || [];

    if (cart.length === 0) {
      // Используем ReplyKeyboard для возврата в меню
      const replyKeyboard = {
        keyboard: [
          [{ text: '🛍️ Каталог' }, { text: '🛒 Корзина' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      };
      await this.bot.sendMessage(chatId, '🛒 Корзина пуста', { reply_markup: replyKeyboard });
      return;
    }

    let message = '🛒 *Ваша корзина:*\n\n';
    let total = 0;

    cart.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      message += `${index + 1}. ${item.productName}`;
      if (item.size) {
        message += ` (Размер: ${item.size})`;
      }
      message += `\n   ${item.quantity} × ${item.price.toFixed(2)} = ${itemTotal.toFixed(2)} сум\n\n`;
    });

    message += `💰 *Итого: ${total.toFixed(2)} сум*`;

    const keyboard = {
      inline_keyboard: [
        ...cart.map((item, index) => [
          {
            text: `➖ ${item.productName}${item.size ? ` (${item.size})` : ''}`,
            callback_data: `remove_item_${index}`,
          },
        ]),
        [
          { text: '✅ Оформить заказ', callback_data: 'checkout' },
          { text: '🗑️ Очистить корзину', callback_data: 'clear_cart' },
        ],
        [{ text: '◀️ Главное меню', callback_data: 'main_menu' }],
      ],
    };

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async removeFromCart(chatId: number, index: number) {
    const cart = this.userCarts.get(chatId) || [];
    if (index >= 0 && index < cart.length) {
      cart.splice(index, 1);
      this.userCarts.set(chatId, cart);
      await this.bot.sendMessage(chatId, '✅ Товар удален из корзины');
      await this.showCart(chatId);
    }
  }

  private async showUserOrders(chatId: number) {
    try {
      // Получаем заказы пользователя
      const response = await axios.get(`${API_URL}/telegram/orders?telegramUserId=${chatId}`);
      const orders = response.data.data || [];

      if (orders.length === 0) {
        const replyKeyboard = {
          keyboard: [
            [{ text: '🛍️ Каталог' }, { text: '🛒 Корзина' }],
            [{ text: '🏠 Главное меню' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: false,
        };
        await this.bot.sendMessage(chatId, '📦 У вас пока нет заказов', { reply_markup: replyKeyboard });
        return;
      }

      // Сохраняем список заказов для пользователя
      this.userOrderLists.set(chatId, orders);
      this.userCurrentOrderIndex.set(chatId, 0);

      // Показываем первый заказ
      await this.showOrderAtIndex(chatId, 0);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при загрузке заказов');
    }
  }

  private async showOrderAtIndex(chatId: number, index: number) {
    try {
      const orders = this.userOrderLists.get(chatId) || [];
      if (orders.length === 0 || index < 0 || index >= orders.length) {
        await this.bot.sendMessage(chatId, '❌ Заказ не найден');
        return;
      }

      const order = orders[index];
      this.userCurrentOrderIndex.set(chatId, index);

      // Получаем детали заказа с товарами
      const orderItemsResponse = await axios.get(`${API_URL}/telegram/orders/${order.id}`);
      const orderData = orderItemsResponse.data.data;
      const fullOrder = orderData.order || order;
      const orderItems = orderData.items || [];

      // Формируем сообщение с информацией о заказе
      let message = `📦 *Заказ ${fullOrder.orderNumber}*\n\n`;
      
      // Статус заказа
      const statusEmoji: { [key: string]: string } = {
        'PENDING': '⏳',
        'PAID': '✅',
        'CANCELLED': '❌',
        'COMPLETED': '🎉',
      };
      const statusText: { [key: string]: string } = {
        'PENDING': 'Ожидает оплаты',
        'PAID': 'Оплачен',
        'CANCELLED': 'Отменен',
        'COMPLETED': 'Завершен',
      };
      message += `${statusEmoji[fullOrder.status] || '📦'} Статус: *${statusText[fullOrder.status] || fullOrder.status}*\n\n`;

      // Товары в заказе
      message += `🛍️ *Товары:*\n\n`;
      orderItems.forEach((item: any, idx: number) => {
        message += `${idx + 1}. ${item.product?.name || 'Товар'}`;
        if (item.size) {
          message += ` (Размер: ${item.size})`;
        }
        message += `\n   ${item.quantity} × ${item.price.toFixed(2)} = ${(item.quantity * item.price).toFixed(2)} сум\n\n`;
      });

      // Скидка и итоговая сумма
      if (fullOrder.discount && fullOrder.discount > 0) {
        const originalTotal = orderItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
        message += `💰 Сумма: ${originalTotal.toFixed(2)} сум\n`;
        message += `🎟️ Скидка: -${fullOrder.discount.toFixed(2)} сум\n`;
      }
      message += `💰 *Итого: ${fullOrder.total.toFixed(2)} сум*\n\n`;

      // Способ оплаты
      if (fullOrder.paymentMethod) {
        const paymentMethods: { [key: string]: string } = {
          'PAYME': 'Payme',
          'CLICK': 'Click',
          'TERMINAL': 'Терминал',
          'CASH': 'Наличные',
        };
        message += `💳 Способ оплаты: ${paymentMethods[fullOrder.paymentMethod] || fullOrder.paymentMethod}\n\n`;
      }

      // Дата создания
      if (fullOrder.createdAt) {
        const date = new Date(fullOrder.createdAt);
        message += `📅 Дата: ${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n`;
      }

      message += `\n${index + 1} из ${orders.length}`;

      // Кнопки навигации (ReplyKeyboard)
      const keyboardRows: any[][] = [];
      
      // Первая строка: Навигация
      const navButtons = [];
      navButtons.push({ text: '◀️ Назад' }); // Всегда показываем
      if (index < orders.length - 1) {
        navButtons.push({ text: 'Вперед ▶️' });
      }
      keyboardRows.push(navButtons);
      
      // Вторая строка: Главное меню
      keyboardRows.push([{ text: '🏠 Главное меню' }]);

      const replyKeyboard = {
        keyboard: keyboardRows,
        resize_keyboard: true,
        one_time_keyboard: false,
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: replyKeyboard,
      });
    } catch (error: any) {
      console.error('[BOT] Error showing order:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при загрузке заказа');
    }
  }

  private async checkout(chatId: number, paymentProvider?: string) {
    const cart = this.userCarts.get(chatId) || [];

    if (cart.length === 0) {
      await this.bot.sendMessage(chatId, '❌ Корзина пуста');
      return;
    }

    // Если платежная система не выбрана, показываем выбор
    if (!paymentProvider) {
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const coupon = this.userCoupon.get(chatId);
      
      // Рассчитываем скидку если есть купон
      let discount = 0;
      let finalTotal = total;
      if (coupon) {
        if (coupon.discountType === 'PERCENTAGE') {
          discount = (total * coupon.discount) / 100;
        } else {
          discount = coupon.discount;
        }
        finalTotal = Math.max(0, total - discount);
      }
      
      let cartMessage = '🛒 *Ваша корзина:*\n\n';
      cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        cartMessage += `${index + 1}. ${item.productName}`;
        if (item.size) {
          cartMessage += ` (Размер: ${item.size})`;
        }
        cartMessage += `\n   ${item.quantity} × ${item.price.toFixed(2)} = ${itemTotal.toFixed(2)} сум\n\n`;
      });
      
      cartMessage += `💰 *Сумма: ${total.toFixed(2)} сум*\n`;
      
      if (coupon) {
        cartMessage += `🎟️ *Купон ${coupon.code}: `;
        if (coupon.discountType === 'PERCENTAGE') {
          cartMessage += `-${coupon.discount}%* (${discount.toFixed(2)} сум)\n`;
        } else {
          cartMessage += `-${discount.toFixed(2)} сум*\n`;
        }
      }
      
      cartMessage += `\n💰 *Итого: ${finalTotal.toFixed(2)} сум*\n\n`;
      cartMessage += `💳 *Выберите способ оплаты:*`;

      const keyboardRows: any[][] = [];
      keyboardRows.push([{ text: '💳 Payme' }, { text: '💳 Click' }]);
      if (!coupon) {
        keyboardRows.push([{ text: '🎟️ Ввести купон' }]);
      } else {
        keyboardRows.push([{ text: '❌ Убрать купон' }]);
      }
      keyboardRows.push([{ text: '❌ Отмена' }]);

      const keyboard = {
        keyboard: keyboardRows,
        resize_keyboard: true,
        one_time_keyboard: false,
      };

      this.userStates.set(chatId, 'selecting_payment');
      await this.bot.sendMessage(chatId, cartMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    }

    // Платежная система выбрана, создаем заказ
    try {
      const items = cart.map((item) => ({
        productId: item.productId,
        size: item.size,
        quantity: item.quantity,
      }));

      const coupon = this.userCoupon.get(chatId);
      const couponCode = coupon?.code;

      const response = await axios.post(
        `${API_URL}/telegram/webhook`,
        {
          telegramUserId: chatId.toString(),
          items,
          paymentMethod: paymentProvider,
          couponCode: couponCode,
        },
        {
          headers: {
            'x-telegram-bot-token': TELEGRAM_BOT_TOKEN,
          },
        }
      );

      const order = response.data.data.order;

      this.userCarts.set(chatId, []);
      this.userStates.delete(chatId);
      this.userPendingOrder.delete(chatId);
      this.userCoupon.delete(chatId);
      this.userOrderLists.delete(chatId);
      this.userCurrentOrderIndex.delete(chatId);

      let orderMessage = `✅ *Заказ оформлен!*\n\n`;
      orderMessage += `📦 Номер заказа: *${order.orderNumber}*\n`;
      
      if (coupon) {
        const originalTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        orderMessage += `💰 Сумма: ${originalTotal.toFixed(2)} сум\n`;
        if (order.discount) {
          orderMessage += `🎟️ Скидка (${coupon.code}): -${order.discount.toFixed(2)} сум\n`;
        }
      }
      
      orderMessage += `💰 Итого: *${order.total.toFixed(2)} сум*\n`;
      orderMessage += `💳 Способ оплаты: ${paymentProvider === 'PAYME' ? 'Payme' : 'Click'}\n`;
      orderMessage += `📊 Статус: Ожидает оплаты\n\n`;
      orderMessage += `Спасибо за ваш заказ! Наш менеджер свяжется с вами в ближайшее время.`;

      await this.bot.sendMessage(chatId, orderMessage, { parse_mode: 'Markdown' });

      const isAdmin = await this.isAdmin(chatId);
      await this.sendMainMenu(chatId, isAdmin);
    } catch (error: any) {
      console.error('Error creating order:', error);
      const errorMessage = error.response?.data?.error || 'Ошибка при оформлении заказа';
      await this.bot.sendMessage(chatId, `❌ ${errorMessage}`);
    }
  }

  private async showAdminPanel(chatId: number) {
    const frontendUrl = FRONTEND_URL || 'http://localhost:5173';
    const isHttps = frontendUrl.startsWith('https://');
    const keyboard: any = {
      inline_keyboard: [
        [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
        [{ text: '📦 Заказы', callback_data: 'admin_orders' }],
        [{ text: '🛍️ Товары', callback_data: 'admin_products' }],
        ...(isHttps 
          ? [[{ text: '🌐 Открыть админ панель в браузере', web_app: { url: `${frontendUrl}/admin` } }]]
          : [[{ text: '🌐 Админ панель (откройте в браузере)', url: `${frontendUrl}/admin` }]]),
        [{ text: '◀️ Главное меню', callback_data: 'main_menu' }],
      ],
    };

    await this.bot.sendMessage(
      chatId,
      '⚙️ *Админ панель*\n\nВыберите действие:',
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  }

  private async showAdminStats(chatId: number) {
    try {
      const response = await axios.get(`${API_URL}/admin/analytics/dashboard`, {
        headers: {
          // Note: In production, you should pass actual auth token
          // For now, this endpoint requires admin auth which bot can't provide
          // You might need to create a special endpoint for Telegram bot or use API key
        },
      });

      const stats = response.data.data || {};
      const today = stats.today || {};
      const allTime = stats.allTime || {};

      const message = 
        `📊 *Статистика за сегодня:*\n\n` +
        `💰 Доход: *${(today.revenue || 0).toFixed(2)} сум*\n` +
        `📦 Заказов: *${today.orders || 0}*\n\n` +
        `📊 *Общая статистика:*\n\n` +
        `💰 Доход: *${(allTime.revenue || 0).toFixed(2)} сум*\n` +
        `📦 Заказов: *${allTime.orders || 0}*`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 Обновить', callback_data: 'admin_stats' }],
          [{ text: '◀️ Админ панель', callback_data: 'admin_panel' }],
        ],
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      const frontendUrl = FRONTEND_URL || 'http://localhost:5173';
      const isHttps = frontendUrl.startsWith('https://');
      const keyboard: any = {
        inline_keyboard: [
          ...(isHttps 
            ? [[{ text: '🌐 Открыть админ панель', web_app: { url: `${frontendUrl}/admin` } }]]
            : [[{ text: '🌐 Админ панель (откройте в браузере)', url: `${frontendUrl}/admin` }]]),
          [{ text: '◀️ Назад', callback_data: 'admin_panel' }],
        ],
      };
      await this.bot.sendMessage(
        chatId,
        '❌ Ошибка при загрузке статистики. Используйте веб-панель.',
        {
          reply_markup: keyboard,
        }
      );
    }
  }

  private async showAdminOrders(chatId: number) {
    const frontendUrl = FRONTEND_URL || 'http://localhost:5173';
    const isHttps = frontendUrl.startsWith('https://');
    const keyboard: any = {
      inline_keyboard: [
        ...(isHttps 
          ? [[{ text: '🌐 Открыть админ панель', web_app: { url: `${frontendUrl}/admin/orders` } }]]
          : [[{ text: `🌐 Админ панель: ${frontendUrl}/admin/orders`, url: `${frontendUrl}/admin/orders` }]]),
        [{ text: '◀️ Админ панель', callback_data: 'admin_panel' }],
      ],
    };
    await this.bot.sendMessage(
      chatId,
      '📦 *Управление заказами*\n\nДля полноценного управления заказами используйте веб-панель:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  private async showAdminProducts(chatId: number) {
    const frontendUrl = FRONTEND_URL || 'http://localhost:5173';
    const isHttps = frontendUrl.startsWith('https://');
    const keyboard: any = {
      inline_keyboard: [
        ...(isHttps 
          ? [[{ text: '🌐 Открыть админ панель', web_app: { url: `${frontendUrl}/admin/products` } }]]
          : [[{ text: `🌐 Админ панель: ${frontendUrl}/admin/products`, url: `${frontendUrl}/admin/products` }]]),
        [{ text: '◀️ Админ панель', callback_data: 'admin_panel' }],
      ],
    };
    await this.bot.sendMessage(
      chatId,
      '🛍️ *Управление товарами*\n\nДля полноценного управления товарами используйте веб-панель:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  public async start() {
    console.log('🤖 Starting Telegram bot...');
    console.log('📡 API_URL:', API_URL);
    console.log('🌐 FRONTEND_URL:', FRONTEND_URL);
    
    // Даем время боту подключиться к Telegram API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test Backend API connection
    try {
      const testResponse = await axios.get(`${API_URL}/categories`, { timeout: 5000 });
      console.log('✅ Backend API connection successful');
    } catch (error: any) {
      console.error('❌ Backend API connection failed:', error.message);
      console.error('⚠️  Убедитесь, что бэкенд запущен на http://localhost:3000');
    }
    
    // Устанавливаем команды бота
    try {
      await this.bot.setMyCommands([
        { command: 'start', description: 'Главное меню' },
        { command: 'catalog', description: 'Каталог товаров' },
        { command: 'cart', description: 'Корзина' },
        { command: 'help', description: 'Помощь' },
      ]);
      console.log('✅ Bot commands set successfully');
    } catch (cmdError: any) {
      console.warn('⚠️  Failed to set bot commands:', cmdError.message);
    }

    // Polling запущен автоматически в конструкторе через { polling: true }
    console.log('✅ Telegram bot is ready and listening for messages!');
  }

  // Public method to send notification to user by telegramUserId
  public async sendNotification(telegramUserId: string | number, message: string): Promise<boolean> {
    try {
      const chatId = typeof telegramUserId === 'string' ? parseInt(telegramUserId) : telegramUserId;
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return true;
    } catch (error: any) {
      console.error(`[BOT] Error sending notification to ${telegramUserId}:`, error);
      return false;
    }
  }
}

// Start the bot
if (require.main === module) {
  try {
    const bot = new SadiaTelegramBot();
    bot.start().catch((error) => {
      console.error('Failed to start bot:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to create bot:', error);
    process.exit(1);
  }
}

export default SadiaTelegramBot;

