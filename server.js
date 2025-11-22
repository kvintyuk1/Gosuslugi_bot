// Express API server for order data
// Run: node server.js
// For production: set PORT environment variable

const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS налаштування для роботи з Firebase Hosting
app.use(cors({
  origin: function (origin, callback) {
    // Дозволити запити без origin (наприклад, мобільні додатки, Postman)
    if (!origin) return callback(null, true);
    
    // Дозволити localhost для розробки
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Дозволити Firebase Hosting домени
    if (origin.includes('web.app') || origin.includes('firebaseapp.com')) {
      return callback(null, true);
    }
    
    // Дозволити всі інші домени (можна обмежити для безпеки)
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Serve static files from src directory
app.use(express.static(path.join(__dirname, "src")));

// Get order by number
app.get("/api/order/:orderNumber", (req, res) => {
  try {
    const orderNumber = req.params.orderNumber.toUpperCase();
    const order = db.findOrder(orderNumber);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      order: {
        number: order.orderNumber,
        recipient: order.recipientName,
        channelName: order.channelName,
        channelDisplay: order.channelName.replace("@", ""),
        productName: order.productName,
        composition: order.composition,
        deliveryAddress: order.deliveryAddress,
        status: order.status,
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all orders (for admin)
app.get("/api/orders", (req, res) => {
  try {
    const orders = db.findAllOrders();
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get orders by recipient (for users to see their orders)
app.get("/api/orders/recipient/:recipientName", (req, res) => {
  try {
    const recipientName = req.params.recipientName;
    const orders = db.findOrdersByRecipient(recipientName);
    res.json({ orders });
  } catch (error) {
    console.error("Error fetching orders by recipient:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new order
app.post("/api/order", (req, res) => {
  try {
    const order = db.addOrder(req.body);
    res.status(201).json({ order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(400).json({ error: error.message });
  }
});

// Update order
app.put("/api/order/:orderNumber", (req, res) => {
  try {
    const orderNumber = req.params.orderNumber.toUpperCase();
    const order = db.updateOrder(orderNumber, req.body);
    res.json({ order });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(404).json({ error: error.message });
  }
});

// Root route - serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Using simple JSON database (orders.json)`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`💡 Try one of these solutions:`);
    console.error(`   1. Kill the process: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`   2. Use a different port: PORT=3001 npm start`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

