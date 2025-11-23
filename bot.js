// Telegram bot integration for Gosuslugi-style order flow.
// Requires: npm install node-telegram-bot-api
// Set BOT_TOKEN env variable before running: BOT_TOKEN=xxx node bot.js

const TelegramBot = require("node-telegram-bot-api");
const db = require("./database");
const fs = require("fs");
const path = require("path");

const token = process.env.BOT_TOKEN || "8402444202:AAH9s1OLTDhBx4h0ztJfeOI6A-4U1CQIUWQ";

const bot = new TelegramBot(token, { polling: true });

console.log("✅ Bot initialized with simple JSON database");

// Файл для збереження адмінів
const ADMINS_FILE = path.join(__dirname, "admins.json");

// Функція для завантаження адмінів з файлу
function loadAdmins() {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = fs.readFileSync(ADMINS_FILE, "utf8");
      const admins = JSON.parse(data);
      console.log(`✅ Завантажено ${admins.length} адмінів з файлу`);
      return admins;
    }
  } catch (error) {
    console.error("❌ Помилка завантаження адмінів:", error);
  }
  return [];
}

// Функція для збереження адмінів у файл
function saveAdmins(admins) {
  try {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2), "utf8");
    console.log(`✅ Збережено ${admins.length} адмінів у файл`);
  } catch (error) {
    console.error("❌ Помилка збереження адмінів:", error);
  }
}

// Admin user IDs (додайте свій Telegram ID)
// Можна додати ID вручну або використати команду /setadmin
let ADMIN_IDS = [523086410]; // Додайте ваш Telegram ID сюди

// Завантажити адмінів з файлу (якщо файл існує)
const fileAdmins = loadAdmins();
if (fileAdmins.length > 0) {
  ADMIN_IDS = fileAdmins;
}

// Завантажити адмінів з змінної середовища (для продакшену, має пріоритет)
if (process.env.ADMIN_IDS) {
  try {
    ADMIN_IDS = JSON.parse(process.env.ADMIN_IDS);
    console.log(`✅ Завантажено ${ADMIN_IDS.length} адмінів з змінної середовища`);
  } catch (e) {
    console.error("❌ Помилка парсингу ADMIN_IDS з env:", e);
  }
}

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
  { command: "myid", description: "Отримати свій Telegram ID" },
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

// Команда для отримання свого Telegram ID
bot.onText(/\/myid/, (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || "не вказано";
  const firstName = msg.from.first_name || "";
  const lastName = msg.from.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim() || "не вказано";
  
  let message = `🆔 Ваш Telegram ID: \`${userId}\`\n\n`;
  message += `👤 Ім'я: ${fullName}\n`;
  message += `📱 Username: @${username}\n\n`;
  
  if (isAdmin(userId)) {
    message += `✅ Ви маєте права адміністратора.`;
  } else {
    message += `❌ Ви не маєте прав адміністратора.\n\n`;
    message += `💡 Щоб стати адміністратором:\n`;
    message += `1. Скопіюйте ваш ID: \`${userId}\`\n`;
    message += `2. Додайте його в файл bot.js в масив ADMIN_IDS\n`;
    message += `3. Перезапустіть бота\n\n`;
    message += `Або якщо немає інших адмінів, використайте команду:\n`;
    message += `/setadmin ${userId}`;
  }
  
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// Команда для встановлення адміна (якщо немає інших адмінів)
bot.onText(/\/setadmin (.+)/, (msg, match) => {
  const userId = msg.from.id;
  const targetId = parseInt(match[1], 10);
  
  // Якщо немає адмінів, дозволити встановити першого
  if (ADMIN_IDS.length === 0) {
    if (!isNaN(targetId)) {
      if (!ADMIN_IDS.includes(targetId)) {
        ADMIN_IDS.push(targetId);
        saveAdmins(ADMIN_IDS); // Зберегти у файл
        bot.sendMessage(
          msg.chat.id,
          `✅ ID ${targetId} додано як адміністратора та збережено у файл.\n\n` +
          `Тепер ви маєте доступ до адмін-панелі!`
        );
      } else {
        bot.sendMessage(msg.chat.id, `❌ Цей ID вже є адміністратором.`);
      }
    } else {
      bot.sendMessage(msg.chat.id, `❌ Неправильний формат ID. Використайте: /setadmin 123456789`);
    }
  } else {
    // Якщо є адміни, тільки адміни можуть додавати інших
    if (isAdmin(userId)) {
      if (!isNaN(targetId)) {
        if (!ADMIN_IDS.includes(targetId)) {
          ADMIN_IDS.push(targetId);
          saveAdmins(ADMIN_IDS); // Зберегти у файл
          bot.sendMessage(
            msg.chat.id,
            `✅ ID ${targetId} додано як адміністратора та збережено у файл.`
          );
        } else {
          bot.sendMessage(msg.chat.id, `❌ Цей ID вже є адміністратором.`);
        }
      } else {
        bot.sendMessage(msg.chat.id, `❌ Неправильний формат ID.`);
      }
    } else {
      bot.sendMessage(
        msg.chat.id,
        `❌ Тільки адміністратори можуть додавати інших адмінів.\n\n` +
        `Використайте /myid щоб дізнатися свій ID та додайте його в код.`
      );
    }
  }
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
      let message = `📦 Замовлення ${order.orderNumber}\n\n`;
      message += `👤 Отримувач: ${order.recipientName}\n`;
      message += `📱 Канал: ${order.channelName}\n`;
      message += `🛍️ Товар: ${order.productName}\n`;
      if (order.price) {
        message += `💰 Ціна: ${order.price} ₽\n`;
      }
      message += `📍 Доставка: ${order.deliveryAddress}\n`;
      if (order.sellerName) {
        message += `👨‍💼 Продавець: ${order.sellerName}\n`;
      }
      message += `📊 Статус: ${order.status}\n`;
      if (order.composition) {
        message += `📝 Склад: ${order.composition}`;
      }
      
      bot.sendMessage(msg.chat.id, message);
    } else {
      bot.sendMessage(msg.chat.id, `❌ Замовлення ${orderNumber} не знайдено.`);
    }
  } catch (error) {
    console.error("Error fetching order:", error);
    bot.sendMessage(msg.chat.id, "❌ Помилка при отриманні даних замовлення.");
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
  const userId = msg.from.id;
  
  if (!isAdmin(userId)) {
    bot.sendMessage(
      msg.chat.id,
      "❌ У вас нет доступа к админ-панели.\n\n" +
      "💡 Щоб стати адміністратором:\n" +
      "1. Використайте команду /myid щоб дізнатися свій Telegram ID\n" +
      "2. Додайте ваш ID в файл bot.js в масив ADMIN_IDS\n" +
      "3. Перезапустіть бота\n\n" +
      "Або якщо немає інших адмінів, використайте:\n" +
      `/setadmin ${userId}`
    );
    return;
  }

  bot.sendMessage(
    msg.chat.id,
    "🔐 Адмін-панель\n\n" +
    "Доступні команди:\n" +
    "/addorder - Створити нове замовлення (покроково)\n" +
    "/listorders - Список всіх замовлень\n" +
    "/status TG-XXXXX - Перевірити статус замовлення\n" +
    "/reload - Перезавантажити базу даних\n" +
    "/cancel - Скасувати створення замовлення\n" +
    "/setadmin ID - Додати адміністратора\n" +
    "/myid - Показати ваш Telegram ID\n\n" +
    "При створенні замовлення номер генерується автоматично!"
  );
});

// Add order command - покрокове створення замовлення
bot.onText(/\/addorder/, async (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, "❌ У вас нет доступа к этой команде.");
    return;
  }

  const userId = msg.from.id;
  
  // Генеруємо номер замовлення автоматично
  const orderNumber = db.generateOrderNumber();
  
  // Ініціалізуємо стан для створення замовлення
  userStates[userId] = {
    mode: "creating_order",
    orderNumber: orderNumber,
    step: 0
  };

  bot.sendMessage(
    msg.chat.id,
    `📝 Створення нового замовлення\n\n` +
    `✅ Номер замовлення автоматично згенеровано: ${orderNumber}\n\n` +
    `Тепер введіть дані покроково:\n\n` +
    `1️⃣ Введіть ім'я отримувача (ПІБ):`
  );
});

// Команда для скасування створення замовлення
bot.onText(/\/cancel/, (msg) => {
  const userId = msg.from.id;
  if (userStates[userId]?.mode === "creating_order") {
    delete userStates[userId];
    bot.sendMessage(msg.chat.id, "❌ Створення замовлення скасовано.");
  } else {
    bot.sendMessage(msg.chat.id, "Немає активного процесу створення замовлення.");
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

// Reload database command
bot.onText(/\/reload/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, "❌ У вас нет доступа к этой команде.");
    return;
  }

  try {
    db.loadDatabase();
    const orders = db.findAllOrders();
    bot.sendMessage(
      msg.chat.id,
      `✅ База даних перезавантажена!\n\n` +
      `📦 Завантажено ${orders.length} замовлень.`
    );
  } catch (error) {
    console.error("Error reloading database:", error);
    bot.sendMessage(msg.chat.id, "❌ Помилка при перезавантаженні бази даних.");
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

    // Крок 1: Ім'я отримувача
    if (state.step === 0) {
      state.recipientName = text;
      state.step = 1;
      bot.sendMessage(
        msg.chat.id,
        `✅ Отримувач: ${state.recipientName}\n\n` +
        `2️⃣ Введіть назву каналу (наприклад: @shtorm_svo або "ШТОРМ | Товары для СВО"):`
      );
      return;
    }

    // Крок 2: Канал
    if (state.step === 1) {
      state.channelName = text;
      state.step = 2;
      bot.sendMessage(
        msg.chat.id,
        `✅ Канал: ${state.channelName}\n\n` +
        `3️⃣ Введіть назву товару:`
      );
      return;
    }

    // Крок 3: Товар
    if (state.step === 2) {
      state.productName = text;
      state.step = 3;
      bot.sendMessage(
        msg.chat.id,
        `✅ Товар: ${state.productName}\n\n` +
        `4️⃣ Введіть ціну товару (в рублях, тільки число, наприклад: 4900):`
      );
      return;
    }

    // Крок 4: Ціна
    if (state.step === 3) {
      const price = parseFloat(text.replace(/[^\d.]/g, ''));
      if (isNaN(price) || price <= 0) {
        bot.sendMessage(
          msg.chat.id,
          `❌ Неправильний формат ціни. Введіть число (наприклад: 4900):`
        );
        return;
      }
      state.price = price;
      state.step = 4;
      bot.sendMessage(
        msg.chat.id,
        `✅ Ціна: ${state.price} ₽\n\n` +
        `5️⃣ Введіть адресу доставки (наприклад: "Карго → Москва → СДЭК до двери" або детальну адресу):`
      );
      return;
    }

    // Крок 5: Адреса доставки
    if (state.step === 4) {
      state.deliveryAddress = text;
      state.step = 5;
      bot.sendMessage(
        msg.chat.id,
        `✅ Адреса доставки: ${state.deliveryAddress}\n\n` +
        `6️⃣ Введіть ім'я продавця (ПІБ продавця):`
      );
      return;
    }

    // Крок 6: Ім'я продавця
    if (state.step === 5) {
      state.sellerName = text;
      state.step = 6;
      bot.sendMessage(
        msg.chat.id,
        `✅ Продавець: ${state.sellerName}\n\n` +
        `7️⃣ Введіть статус замовлення (наприклад: "Ожидает оплаты" або залиште порожнім для значення за замовчуванням):`
      );
      return;
    }

    // Крок 7: Статус (опціонально)
    if (state.step === 6) {
      state.status = text || "Ожидает оплаты";

      try {
        const order = {
          orderNumber: state.orderNumber,
          recipientName: state.recipientName,
          channelName: state.channelName,
          productName: state.productName,
          price: state.price,
          deliveryAddress: state.deliveryAddress,
          sellerName: state.sellerName,
          status: state.status,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        db.addOrder(order);
        delete userStates[userId];

        bot.sendMessage(
          msg.chat.id,
          `✅ Замовлення ${order.orderNumber} успішно створено!\n\n` +
          `📋 Деталі замовлення:\n` +
          `👤 Отримувач: ${order.recipientName}\n` +
          `📱 Канал: ${order.channelName}\n` +
          `🛍️ Товар: ${order.productName}\n` +
          `💰 Ціна: ${order.price} ₽\n` +
          `📍 Доставка: ${order.deliveryAddress}\n` +
          `👨‍💼 Продавець: ${order.sellerName}\n` +
          `📊 Статус: ${order.status}\n\n` +
          `🔗 Посилання для оплати: [Відкрити замовлення]`
        );
      } catch (error) {
        console.error("Error creating order:", error);
        bot.sendMessage(msg.chat.id, `❌ Помилка при створенні замовлення: ${error.message}`);
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

