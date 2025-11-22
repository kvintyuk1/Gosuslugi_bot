// Telegram bot integration for Gosuslugi-style order flow.
// Requires: npm install node-telegram-bot-api
// Set BOT_TOKEN env variable before running: BOT_TOKEN=xxx node bot.js

const TelegramBot = require("node-telegram-bot-api");
const db = require("./database");

const token = process.env.BOT_TOKEN || "8402444202:AAH9s1OLTDhBx4h0ztJfeOI6A-4U1CQIUWQ";

const bot = new TelegramBot(token, { polling: true });

console.log("✅ Bot initialized with simple JSON database");

// Admin user IDs (додайте свій Telegram ID)
const ADMIN_IDS = []; // Додайте ваш Telegram ID сюди

function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

const capabilities = [
  "✅ Принимать заявки из любых партнёрских Telegram-каналов.",
  "💳 Создавать ссылку на оплату в интерфейсе Госуслуг и фиксировать квитанцию.",
  "📦 Отслеживать доставку: карго → Москва → СДЭК до двери клиента.",
  "🧾 Проверять отправленные квитанции и подтверждать статус заказа.",
  "🔔 Уведомлять покупателя о каждом этапе — заявка, оплата, карго, доставка.",
];

bot.setMyCommands([
  { command: "start", description: "Коротко о возможностях бота" },
  { command: "status", description: "Текущий статус заказа" },
  { command: "myorders", description: "Мои замовлення" },
  { command: "help", description: "Как отправить квитанцию и получить доставку" },
  { command: "admin", description: "Админ-панель (только для админов)" },
  { command: "addorder", description: "Создать новое замовлення (админ)" },
]);

bot.onText(/\/start/, (msg) => {
  const intro =
    "Привет! Я бот Госуслуг для подтверждения оплаты товара, оформленного через любой доверенный Telegram-канал.\n\n" +
    "Вот что я умею:";

  const message = [intro, ...capabilities.map((item) => `• ${item}`)].join("\n");

  bot.sendMessage(msg.chat.id, message);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    [
      "1. Оформите заказ у менеджера канала.",
      "2. Перейдите по ссылке оплаты в стиле Госуслуг и оплатите нужный пакет.",
      "3. Отправьте квитанцию сюда или @gosuslugi_support_bot.",
      "4. Дождитесь подтверждения: после проверки начнётся доставка карго → СДЭК.",
    ].join("\n")
  );
});

bot.onText(/\/status/, (msg) => {
  const text = msg.text;
  const orderNumber = text.replace("/status", "").trim();
  
  if (!orderNumber) {
    bot.sendMessage(
      msg.chat.id,
      "Укажите номер заказа в формате:\n/status TG-XXXXX\n\nНапример: /status TG-28451"
    );
    return;
  }

  try {
    const order = db.findOrder(orderNumber);
    if (order) {
      bot.sendMessage(
        msg.chat.id,
        `📦 Заказ ${order.orderNumber}\n\n` +
        `👤 Получатель: ${order.recipientName}\n` +
        `📱 Канал: ${order.channelName}\n` +
        `🛍️ Товар: ${order.productName}\n` +
        `📍 Доставка: ${order.deliveryAddress}\n` +
        `📊 Статус: ${order.status}\n` +
        `📝 Состав: ${order.composition || "Не указано"}`
      );
    } else {
      bot.sendMessage(msg.chat.id, `❌ Заказ ${orderNumber} не найден.`);
    }
  } catch (error) {
    console.error("Error fetching order:", error);
    bot.sendMessage(msg.chat.id, "❌ Ошибка при получении данных заказа.");
  }
});

// Команда для користувачів - показати свої замовлення
bot.onText(/\/myorders/, (msg) => {
  const userName = msg.from.first_name || msg.from.username || "";
  
  try {
    const orders = db.findOrdersByRecipient(userName);
    
    if (orders.length === 0) {
      bot.sendMessage(
        msg.chat.id,
        `📭 Замовлень для "${userName}" не найдено.\n\n` +
        `Використовуйте /status TG-XXXXX для перевірки конкретного замовлення.`
      );
      return;
    }

    let message = `📋 Ваши замовлення (${orders.length}):\n\n`;
    orders.forEach((order, index) => {
      message += `${index + 1}. ${order.orderNumber}\n`;
      message += `   Товар: ${order.productName}\n`;
      message += `   Статус: ${order.status}\n\n`;
    });

    bot.sendMessage(msg.chat.id, message);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    bot.sendMessage(msg.chat.id, "❌ Ошибка при получении списка замовлень.");
  }
});

// Admin commands
bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, "❌ У вас нет доступа к админ-панели.");
    return;
  }

  bot.sendMessage(
    msg.chat.id,
    "🔐 Админ-панель\n\n" +
    "Доступные команды:\n" +
    "/addorder - Создать новое замовлення\n" +
    "/listorders - Список всех замовлень\n" +
    "/editorder - Редагувати замовлення\n" +
    "/status TG-XXXXX - Перевірити статус замовлення"
  );
});

// Add order command
bot.onText(/\/addorder/, async (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, "❌ У вас нет доступа к этой команде.");
    return;
  }

  bot.sendMessage(
    msg.chat.id,
    "📝 Создание нового замовлення\n\n" +
    "Отправьте данные в следующем формате:\n\n" +
    "Номер заказа: TG-XXXXX\n" +
    "Имя пользователя: Имя Фамилия\n" +
    "Канал: @channel_name\n" +
    "Товар: Название товара\n" +
    "Состав: Описание состава\n" +
    "Доставка: Адрес доставки\n" +
    "Статус: Ожидает оплаты\n\n" +
    "Или используйте команду:\n" +
    "/addorder TG-XXXXX|Имя|@канал|Товар|Состав|Доставка|Статус"
  );
});

// Parse addorder with data
bot.onText(/\/addorder (.+)/, (msg, match) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, "❌ У вас нет доступа к этой команде.");
    return;
  }

  const data = match[1].split("|").map(s => s.trim());
  if (data.length < 7) {
    bot.sendMessage(
      msg.chat.id,
      "❌ Неверный формат. Используйте:\n" +
      "/addorder TG-XXXXX|Имя|@канал|Товар|Состав|Доставка|Статус"
    );
    return;
  }

  const [orderNumber, recipientName, channelName, productName, composition, deliveryAddress, status] = data;

  try {
    const order = {
      orderNumber: orderNumber.toUpperCase(),
      recipientName,
      channelName,
      productName,
      composition,
      deliveryAddress,
      status,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    db.addOrder(order);
    bot.sendMessage(
      msg.chat.id,
      `✅ Замовлення ${orderNumber} успешно создано!\n\n` +
      `👤 Получатель: ${recipientName}\n` +
      `📱 Канал: ${channelName}\n` +
      `🛍️ Товар: ${productName}\n` +
      `📊 Статус: ${status}`
    );
  } catch (error) {
    console.error("Error creating order:", error);
    bot.sendMessage(msg.chat.id, `❌ Ошибка при создании замовлення: ${error.message}`);
  }
});

// List all orders
bot.onText(/\/listorders/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, "❌ У вас нет доступа к этой команде.");
    return;
  }

  try {
    const orders = db.getRecentOrders(10);
    if (orders.length === 0) {
      bot.sendMessage(msg.chat.id, "📭 Замовлень пока нет.");
      return;
    }

    const list = orders.map((o, i) => 
      `${i + 1}. ${o.orderNumber} - ${o.recipientName} (${o.status})`
    ).join("\n");

    bot.sendMessage(msg.chat.id, `📋 Последние замовлення:\n\n${list}`);
  } catch (error) {
    console.error("Error listing orders:", error);
    bot.sendMessage(msg.chat.id, "❌ Ошибка при получении списка замовлень.");
  }
});

// Handle inline order creation (step by step)
const userStates = {};

bot.on("message", (msg) => {
  if (msg.text?.startsWith("/")) return;

  const userId = msg.from.id;
  
  // If admin is creating order step by step
  if (isAdmin(userId) && userStates[userId]?.mode === "creating_order") {
    const state = userStates[userId];
    const text = msg.text.trim();

    if (!state.orderNumber) {
      state.orderNumber = text.toUpperCase();
      bot.sendMessage(msg.chat.id, `✅ Номер заказа: ${state.orderNumber}\n\nВведите имя получателя:`);
      return;
    }
    if (!state.recipientName) {
      state.recipientName = text;
      bot.sendMessage(msg.chat.id, `✅ Получатель: ${state.recipientName}\n\nВведите канал (например: @shtorm_svo):`);
      return;
    }
    if (!state.channelName) {
      state.channelName = text;
      bot.sendMessage(msg.chat.id, `✅ Канал: ${state.channelName}\n\nВведите название товара:`);
      return;
    }
    if (!state.productName) {
      state.productName = text;
      bot.sendMessage(msg.chat.id, `✅ Товар: ${state.productName}\n\nВведите состав заказа:`);
      return;
    }
    if (!state.composition) {
      state.composition = text;
      bot.sendMessage(msg.chat.id, `✅ Состав: ${state.composition}\n\nВведите адрес доставки:`);
      return;
    }
    if (!state.deliveryAddress) {
      state.deliveryAddress = text;
      bot.sendMessage(msg.chat.id, `✅ Доставка: ${state.deliveryAddress}\n\nВведите статус (например: Ожидает оплаты):`);
      return;
    }
    if (!state.status) {
      state.status = text;

      try {
        const order = {
          orderNumber: state.orderNumber,
          recipientName: state.recipientName,
          channelName: state.channelName,
          productName: state.productName,
          composition: state.composition,
          deliveryAddress: state.deliveryAddress,
          status: state.status,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        db.addOrder(order);
        delete userStates[userId];

        bot.sendMessage(
          msg.chat.id,
          `✅ Замовлення ${order.orderNumber} успешно создано!\n\n` +
          `👤 Получатель: ${order.recipientName}\n` +
          `📱 Канал: ${order.channelName}\n` +
          `🛍️ Товар: ${order.productName}\n` +
          `📊 Статус: ${order.status}`
        );
      } catch (error) {
        console.error("Error creating order:", error);
        bot.sendMessage(msg.chat.id, `❌ Ошибка при создании замовлення: ${error.message}`);
        delete userStates[userId];
      }
      return;
    }
  }

  // Default message
  bot.sendMessage(
    msg.chat.id,
    "Пришлите команду /start чтобы узнать мои возможности или /help для инструкции."
  );
});

