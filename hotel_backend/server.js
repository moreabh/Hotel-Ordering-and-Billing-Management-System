// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MySQL connection config
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

// ======================
// 1. MENU ENDPOINT
// ======================
app.get('/api/menu', async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute('SELECT * FROM menu');
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch menu' });
  }
});

// ======================
// 2. CART ENDPOINTS
// ======================

// Add item to cart
app.post('/api/cart/add', async (req, res) => {
  try {
    const { table_id, menu_id, quantity } = req.body;
    const conn = await mysql.createConnection(dbConfig);

    const [existing] = await conn.execute(
      'SELECT * FROM cart WHERE table_id = ? AND menu_id = ?',
      [table_id, menu_id]
    );

    if (existing.length > 0) {
      await conn.execute(
        'UPDATE cart SET quantity = quantity + ?, added_at = NOW() WHERE table_id = ? AND menu_id = ?',
        [quantity, table_id, menu_id]
      );
    } else {
      await conn.execute(
        'INSERT INTO cart (table_id, menu_id, quantity) VALUES (?, ?, ?)',
        [table_id, menu_id, quantity]
      );
    }

    await conn.end();
    res.json({ message: 'Item added to cart successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add to cart' });
  }
});

// Fetch cart for a table (includes added_at)
app.get('/api/cart/:table_id', async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const conn = await mysql.createConnection(dbConfig);

    const [rows] = await conn.execute(
      `SELECT c.menu_id, m.item_name, m.price, c.quantity, 
              (c.quantity * m.price) AS total_price, c.added_at
       FROM cart c
       JOIN menu m ON c.menu_id = m.menu_id
       WHERE c.table_id = ?`,
      [table_id]
    );

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

// Update cart quantity
app.put('/api/cart/update', async (req, res) => {
  try {
    const { table_id, menu_id, quantity } = req.body;
    const conn = await mysql.createConnection(dbConfig);

    if (!table_id || !menu_id || quantity == null) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (quantity < 1) {
      await conn.execute(
        'DELETE FROM cart WHERE table_id = ? AND menu_id = ?',
        [table_id, menu_id]
      );
    } else {
      await conn.execute(
        'UPDATE cart SET quantity = ?, added_at = NOW() WHERE table_id = ? AND menu_id = ?',
        [quantity, table_id, menu_id]
      );
    }

    await conn.end();
    res.json({ message: 'Cart updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update cart' });
  }
});

// Remove item from cart
app.delete('/api/cart/remove/:table_id/:menu_id', async (req, res) => {
  try {
    const { table_id, menu_id } = req.params;
    const conn = await mysql.createConnection(dbConfig);

    await conn.execute('DELETE FROM cart WHERE table_id = ? AND menu_id = ?', [
      table_id,
      menu_id,
    ]);

    await conn.end();
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to remove cart item' });
  }
});

// ======================
// 3. ORDERS ENDPOINTS
// ======================

// Place order
app.post('/api/order/place', async (req, res) => {
  const { table_id, payment_mode } = req.body;
  const conn = await mysql.createConnection(dbConfig);

  try {
    const [cartItems] = await conn.execute(
      `SELECT c.menu_id, m.price, c.quantity
       FROM cart c
       JOIN menu m ON c.menu_id = m.menu_id
       WHERE c.table_id = ?`,
      [table_id]
    );

    if (cartItems.length === 0) {
      await conn.end();
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const total_amount = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const [orderResult] = await conn.execute(
      'INSERT INTO orders (table_id, total_amount) VALUES (?, ?)',
      [table_id, total_amount]
    );

    const order_id = orderResult.insertId;

    const orderItemsQuery = cartItems
      .map(item => `(${order_id}, ${item.menu_id}, ${item.quantity})`)
      .join(',');

    await conn.execute(
      `INSERT INTO order_items (order_id, menu_id, quantity) VALUES ${orderItemsQuery}`
    );

    await conn.execute(
      'INSERT INTO payments (order_id, amount, payment_method) VALUES (?, ?, ?)',
      [order_id, total_amount, payment_mode]
    );

    await conn.execute('DELETE FROM cart WHERE table_id = ?', [table_id]);

    await conn.end();
    res.json({ message: 'Order placed successfully', order_id });
  } catch (err) {
    console.error(err);
    await conn.end();
    res.status(500).json({ message: 'Failed to place order' });
  }
});

// Get orders for a table
app.get('/api/orders/:table_id', async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const conn = await mysql.createConnection(dbConfig);

    const [orders] = await conn.execute(
      `SELECT o.*, p.payment_method, p.payment_status
       FROM orders o
       LEFT JOIN payments p ON o.order_id = p.order_id
       WHERE o.table_id = ? ORDER BY o.order_time DESC`,
      [table_id]
    );

    await conn.end();
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
// ======================
// 2. CART ENDPOINTS (Updated)
// ======================

// Add item to cart
app.post('/api/cart/add', async (req, res) => {
  try {
    const { table_id, menu_id, quantity } = req.body;
    const conn = await mysql.createConnection(dbConfig);

    // Check if item already in cart
    const [existing] = await conn.execute(
      'SELECT * FROM cart WHERE table_id = ? AND menu_id = ?',
      [table_id, menu_id]
    );

    if (existing.length > 0) {
      // Update quantity and timestamp
      await conn.execute(
        'UPDATE cart SET quantity = quantity + ?, added_at = NOW() WHERE table_id = ? AND menu_id = ?',
        [quantity, table_id, menu_id]
      );
    } else {
      // Insert new
      await conn.execute(
        'INSERT INTO cart (table_id, menu_id, quantity, added_at) VALUES (?, ?, ?, NOW())',
        [table_id, menu_id, quantity]
      );
    }

    // Fetch updated cart to return
    const [cartItems] = await conn.execute(
      `SELECT c.menu_id, m.item_name, m.price, c.quantity, (m.price * c.quantity) AS total_price, c.added_at
       FROM cart c
       JOIN menu m ON c.menu_id = m.menu_id
       WHERE c.table_id = ?`,
      [table_id]
    );

    await conn.end();
    res.json({ message: 'Item added to cart successfully', cart: cartItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add to cart' });
  }
});

// Fetch cart for a table
app.get('/api/cart/:table_id', async (req, res) => {
  try {
    const table_id = req.params.table_id;
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(
      `SELECT c.menu_id, m.item_name, m.price, c.quantity, (m.price * c.quantity) AS total_price, c.added_at
       FROM cart c
       JOIN menu m ON c.menu_id = m.menu_id
       WHERE c.table_id = ?`,
      [table_id]
    );
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

// Update cart quantity (+/-)
app.put('/api/cart/update', async (req, res) => {
  try {
    const { table_id, menu_id, quantity } = req.body;
    const conn = await mysql.createConnection(dbConfig);

    if (quantity < 1) {
      // Remove item if quantity < 1
      await conn.execute('DELETE FROM cart WHERE table_id = ? AND menu_id = ?', [table_id, menu_id]);
    } else {
      // Update quantity and timestamp
      await conn.execute(
        'UPDATE cart SET quantity = ?, added_at = NOW() WHERE table_id = ? AND menu_id = ?',
        [quantity, table_id, menu_id]
      );
    }

    // Fetch updated cart
    const [cartItems] = await conn.execute(
      `SELECT c.menu_id, m.item_name, m.price, c.quantity, (m.price * c.quantity) AS total_price, c.added_at
       FROM cart c
       JOIN menu m ON c.menu_id = m.menu_id
       WHERE c.table_id = ?`,
      [table_id]
    );

    await conn.end();
    res.json({ message: 'Cart updated successfully', cart: cartItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update cart' });
  }
});

// Remove item from cart
app.delete('/api/cart/remove/:table_id/:menu_id', async (req, res) => {
  try {
    const { table_id, menu_id } = req.params;
    const conn = await mysql.createConnection(dbConfig);

    await conn.execute('DELETE FROM cart WHERE table_id = ? AND menu_id = ?', [table_id, menu_id]);

    // Fetch updated cart
    const [cartItems] = await conn.execute(
      `SELECT c.menu_id, m.item_name, m.price, c.quantity, (m.price * c.quantity) AS total_price, c.added_at
       FROM cart c
       JOIN menu m ON c.menu_id = m.menu_id
       WHERE c.table_id = ?`,
      [table_id]
    );

    await conn.end();
    res.json({ message: 'Item removed from cart', cart: cartItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to remove cart item' });
  }
});

