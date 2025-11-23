// Проста база даних без MongoDB
// Зберігає дані в пам'яті та синхронізує з JSON файлом

const fs = require("fs");
const path = require("path");

// Використовувати Railway Volume або локальний файл
// Railway Volume монтується в /data, якщо він налаштований
// Перевіряємо, чи існує /data (Railway Volume), інакше використовуємо поточну директорію
let DATA_DIR = __dirname;
if (fs.existsSync("/data")) {
  DATA_DIR = "/data";
  console.log("📦 Використовується Railway Volume: /data");
} else if (process.env.DATA_DIR) {
  DATA_DIR = process.env.DATA_DIR;
  console.log(`📦 Використовується DATA_DIR з env: ${DATA_DIR}`);
} else {
  console.log(`📦 Використовується локальна директорія: ${DATA_DIR}`);
}

const DB_FILE = path.join(DATA_DIR, "orders.json");
console.log(`📂 Шлях до файлу БД: ${DB_FILE}`);

// In-memory база даних
let orders = [];
let lastModifiedTime = 0; // Час останньої модифікації файлу

// Отримати час модифікації файлу
function getFileModificationTime() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const stats = fs.statSync(DB_FILE);
      return stats.mtimeMs;
    }
  } catch (error) {
    // Ігноруємо помилки
  }
  return 0;
}

// Перевірити чи потрібно перезавантажити базу даних
function needsReload() {
  const currentModTime = getFileModificationTime();
  // Завжди перезавантажувати, якщо файл існує і час модифікації відрізняється
  // Це важливо, оскільки бот і сервер - різні процеси
  if (currentModTime > 0 && currentModTime !== lastModifiedTime) {
    return true;
  }
  return false;
}

// Завантажити дані з файлу
function loadDatabase(silent = false) {
  try {
    console.log(`📂 Шлях до файлу БД: ${DB_FILE}`);
    console.log(`📂 Файл існує: ${fs.existsSync(DB_FILE)}`);
    
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      orders = JSON.parse(data);
      lastModifiedTime = getFileModificationTime();
      
      if (!silent) {
        console.log(`✅ Завантажено ${orders.length} замовлень з файлу ${DB_FILE}`);
        if (orders.length > 0) {
          console.log(`📝 Перші 3 номери: ${orders.slice(0, 3).map(o => o.orderNumber).join(', ')}`);
        }
      }
    } else {
      console.log(`⚠️ Файл ${DB_FILE} не існує, створюємо новий`);
      orders = [];
      saveDatabase(); // Створити порожній файл
      if (!silent) {
      console.log("✅ Створено нову базу даних");
      }
    }
  } catch (error) {
    console.error("❌ Помилка завантаження бази даних:", error);
    console.error("❌ Деталі помилки:", error.message);
    console.error("❌ Stack:", error.stack);
    orders = [];
  }
}

// Зберегти дані в файл
function saveDatabase() {
  try {
    // Створити директорію, якщо її немає
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Створено директорію: ${dir}`);
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2), "utf8");
    // Оновити час модифікації після збереження
    lastModifiedTime = getFileModificationTime();
    console.log(`💾 Збережено ${orders.length} замовлень у файл: ${DB_FILE}`);
  } catch (error) {
    console.error("❌ Помилка збереження бази даних:", error);
    console.error("❌ Деталі помилки:", error.message);
  }
}

// Ініціалізувати базу даних
loadDatabase();

// Функції для роботи з замовленнями

// Генерація номера замовлення
function generateOrderNumber() {
  // Завжди перезавантажувати перед генерацією для актуальності
  loadDatabase(true); // Тихий режим для автоматичного перезавантаження
  
  // Знайти найбільший номер замовлення
  let maxNumber = 0;
  orders.forEach((order) => {
    const match = order.orderNumber.match(/TG-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  });
  
  // Згенерувати новий номер (наступний після максимального)
  const newNumber = maxNumber + 1;
  return `TG-${newNumber.toString().padStart(5, '0')}`;
}

// Знайти замовлення за номером
function findOrder(orderNumber) {
  // Завжди перезавантажувати перед пошуком для гарантії актуальності
  // (бот і сервер - різні процеси, тому потрібно завжди читати з файлу)
  loadDatabase(true); // Тихий режим для автоматичного перезавантаження
  
  const searchNumber = orderNumber.toUpperCase();
  console.log(`🔎 findOrder: шукаємо "${searchNumber}", всього замовлень: ${orders.length}`);
  
  const found = orders.find((o) => {
    const match = o.orderNumber === searchNumber;
    if (match) {
      console.log(`✅ Знайдено збіг: ${o.orderNumber} === ${searchNumber}`);
    }
    return match;
  });
  
  if (!found) {
    console.log(`❌ Не знайдено замовлення "${searchNumber}"`);
    console.log(`📋 Доступні номери: ${orders.map(o => o.orderNumber).join(', ')}`);
  }
  
  return found;
}

// Знайти всі замовлення
function findAllOrders() {
  // Завжди перезавантажувати перед пошуком для гарантії актуальності
  loadDatabase(true); // Тихий режим для автоматичного перезавантаження
  return [...orders]; // Повертаємо копію масиву
}

// Додати нове замовлення
function addOrder(order) {
  // Перевірити чи не існує вже замовлення з таким номером
  if (findOrder(order.orderNumber)) {
    throw new Error(`Замовлення ${order.orderNumber} вже існує`);
  }

  const newOrder = {
    orderNumber: order.orderNumber.toUpperCase(),
    recipientName: order.recipientName,
    channelName: order.channelName,
    productName: order.productName,
    composition: order.composition || "",
    deliveryAddress: order.deliveryAddress,
    price: order.price || 0,
    sellerName: order.sellerName || "",
    status: order.status || "Ожидает оплаты",
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.updatedAt || new Date().toISOString(),
  };

  orders.push(newOrder);
  saveDatabase();
  return newOrder;
}

// Оновити замовлення
function updateOrder(orderNumber, updates) {
  const order = findOrder(orderNumber);
  if (!order) {
    throw new Error(`Замовлення ${orderNumber} не знайдено`);
  }

  Object.assign(order, updates, {
    updatedAt: new Date().toISOString(),
  });

  saveDatabase();
  return order;
}

// Видалити замовлення
function deleteOrder(orderNumber) {
  const index = orders.findIndex(
    (o) => o.orderNumber === orderNumber.toUpperCase()
  );
  if (index === -1) {
    throw new Error(`Замовлення ${orderNumber} не знайдено`);
  }

  const deleted = orders.splice(index, 1)[0];
  saveDatabase();
  return deleted;
}

// Знайти замовлення за отримувачем (для користувачів)
function findOrdersByRecipient(recipientName) {
  // Завжди перезавантажувати перед пошуком для гарантії актуальності
  loadDatabase(true); // Тихий режим для автоматичного перезавантаження
  return orders.filter(
    (o) =>
      o.recipientName &&
      o.recipientName.toLowerCase().includes(recipientName.toLowerCase())
  );
}

// Знайти замовлення за каналом
function findOrdersByChannel(channelName) {
  // Завжди перезавантажувати перед пошуком для гарантії актуальності
  loadDatabase(true); // Тихий режим для автоматичного перезавантаження
  return orders.filter(
    (o) =>
      o.channelName &&
      o.channelName.toLowerCase().includes(channelName.toLowerCase())
  );
}

// Отримати останні N замовлень
function getRecentOrders(limit = 10) {
  // Завжди перезавантажувати перед пошуком для гарантії актуальності
  loadDatabase(true); // Тихий режим для автоматичного перезавантаження
  return orders
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

module.exports = {
  findOrder,
  findAllOrders,
  addOrder,
  updateOrder,
  deleteOrder,
  findOrdersByRecipient,
  findOrdersByChannel,
  getRecentOrders,
  loadDatabase,
  saveDatabase,
  generateOrderNumber,
};

