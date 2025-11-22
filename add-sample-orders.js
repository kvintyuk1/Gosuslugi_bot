// Скрипт для додавання прикладів замовлень
const db = require("./database");

const sampleOrders = [
  {
    orderNumber: "TG-28451",
    recipientName: "Андрей Коваленко",
    channelName: "@shtorm_svo",
    productName: "Смарт-часы",
    composition: "Смарт-часы · ремешок · гарантия",
    deliveryAddress: "Карго → Москва → СДЭК до двери",
    status: "Ожидает оплаты",
  },
  {
    orderNumber: "TG-28452",
    recipientName: "Мария Петрова",
    channelName: "@shtorm_svo",
    productName: "Планшет",
    composition: "Планшет 10 дюймов · чехол · зарядка",
    deliveryAddress: "Карго → Москва → СДЭК до двери",
    status: "Оплачен",
  },
  {
    orderNumber: "TG-28453",
    recipientName: "Иван Сидоров",
    channelName: "@shtorm_svo",
    productName: "Наушники",
    composition: "Беспроводные наушники · чехол · кабель USB",
    deliveryAddress: "Карго → Москва → СДЭК до двери",
    status: "В доставке",
  },
  {
    orderNumber: "TG-28454",
    recipientName: "Ольга Иванова",
    channelName: "@shtorm_svo",
    productName: "Телефон",
    composition: "Смартфон · защитное стекло · чехол",
    deliveryAddress: "Карго → Москва → СДЭК до двери",
    status: "Ожидает оплаты",
  },
  {
    orderNumber: "TG-28455",
    recipientName: "Дмитрий Смирнов",
    channelName: "@shtorm_svo",
    productName: "Ноутбук",
    composition: "Ноутбук 15.6 · сумка · мышь",
    deliveryAddress: "Карго → Москва → СДЭК до двери",
    status: "Подтверждена",
  },
];

console.log("📦 Додаю приклади замовлень...\n");

sampleOrders.forEach((order) => {
  try {
    // Перевірити чи не існує вже
    const existing = db.findOrder(order.orderNumber);
    if (existing) {
      console.log(`⚠️  Замовлення ${order.orderNumber} вже існує, пропускаю`);
      return;
    }

    const added = db.addOrder(order);
    console.log(`✅ Додано: ${added.orderNumber} - ${added.recipientName} (${added.status})`);
  } catch (error) {
    console.error(`❌ Помилка додавання ${order.orderNumber}:`, error.message);
  }
});

console.log(`\n✅ Готово! Додано ${sampleOrders.length} прикладів замовлень.`);

