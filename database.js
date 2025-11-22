// Проста база даних без MongoDB
// Зберігає дані в пам'яті та синхронізує з JSON файлом

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "orders.json");

// In-memory база даних
let orders = [];

// Завантажити дані з файлу
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      orders = JSON.parse(data);
      console.log(`✅ Завантажено ${orders.length} замовлень з файлу`);
    } else {
      orders = [];
      saveDatabase(); // Створити порожній файл
      console.log("✅ Створено нову базу даних");
    }
  } catch (error) {
    console.error("❌ Помилка завантаження бази даних:", error);
    orders = [];
  }
}

// Зберегти дані в файл
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2), "utf8");
  } catch (error) {
    console.error("❌ Помилка збереження бази даних:", error);
  }
}

// Ініціалізувати базу даних
loadDatabase();

// Функції для роботи з замовленнями

// Знайти замовлення за номером
function findOrder(orderNumber) {
  return orders.find((o) => o.orderNumber === orderNumber.toUpperCase());
}

// Знайти всі замовлення
function findAllOrders() {
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
  return orders.filter(
    (o) =>
      o.recipientName &&
      o.recipientName.toLowerCase().includes(recipientName.toLowerCase())
  );
}

// Знайти замовлення за каналом
function findOrdersByChannel(channelName) {
  return orders.filter(
    (o) =>
      o.channelName &&
      o.channelName.toLowerCase().includes(channelName.toLowerCase())
  );
}

// Отримати останні N замовлень
function getRecentOrders(limit = 10) {
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
};

