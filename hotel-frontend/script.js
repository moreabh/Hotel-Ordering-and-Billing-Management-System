// ======================
// GLOBAL CONFIGURATION
// ======================
const API_URL = "http://localhost:5000/api"; // Backend URL
const TABLE_ID = 1; // Example table number, change dynamically if needed

// ======================
// 1. MENU PAGE FUNCTIONS
// ======================

// Fetch Menu
async function fetchMenu() {
  try {
    const response = await fetch(`${API_URL}/menu`);
    if (!response.ok) throw new Error("Failed to fetch menu");

    const menu = await response.json();
    const menuContainer = document.getElementById("menu-container");

    if (!menuContainer) return; // If we're not on the menu page, exit

    menuContainer.innerHTML = "";

    menu.forEach(item => {
      const div = document.createElement("div");
      div.classList.add("menu-item");
      div.innerHTML = `
        <h3>${item.item_name}</h3>
        <p>${item.description || ''}</p>
        <p>₹${item.price}</p>
        <button onclick="addToCart(${item.menu_id})">Add to Cart</button>
      `;
      menuContainer.appendChild(div);
    });
  } catch (error) {
    console.error("Error fetching menu:", error);
    alert("Failed to load menu items. Please try again.");
  }
}

// Add item to cart
async function addToCart(menu_id) {
  try {
    console.log("Sending to backend:", {
      table_id: TABLE_ID,
      menu_id: menu_id,
      quantity: 1
    });

    const response = await fetch(`${API_URL}/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        table_id: TABLE_ID,
        menu_id: menu_id,
        quantity: 1
      })
    });

    const result = await response.json();
    console.log("Backend response:", result);

    if (!response.ok) {
      alert(result.message || "Failed to add item to cart");
      return;
    }

    alert(result.message || "Item added to cart!");
    fetchCart(); // Refresh the cart after adding item
  } catch (error) {
    console.error("Error adding to cart:", error);
    alert("Network error. Check console for details.");
  }
}

// ======================
// 2. CART PAGE FUNCTIONS
// ======================

// Fetch Cart
async function fetchCart() {
  try {
    const response = await fetch(`${API_URL}/cart/${TABLE_ID}`);
    if (!response.ok) throw new Error("Failed to fetch cart data");

    const cartItems = await response.json();
    displayCart(cartItems);
  } catch (error) {
    console.error("Error fetching cart:", error);
    alert("Error loading cart. Please try again.");
  }
}

// Display Cart with Added At & Quantity Update/Remove
function displayCart(cartItems) {
  const cartBody = document.getElementById("cartBody");
  const totalAmountEl = document.getElementById("totalAmount");

  if (!cartBody || !totalAmountEl) return;

  cartBody.innerHTML = "";
  let totalAmount = 0;

  if (!cartItems || cartItems.length === 0) {
    cartBody.innerHTML = `<tr><td colspan="6">Your cart is empty.</td></tr>`;
    totalAmountEl.textContent = "0.00";
    return;
  }

  cartItems.forEach(item => {
    totalAmount += parseFloat(item.total_price);

    const addedAt = new Date(item.added_at).toLocaleString();

    const row = `
      <tr>
        <td>${item.item_name}</td>
        <td>₹${item.price}</td>
        <td>
          <button onclick="updateCartQuantity(${item.menu_id}, ${item.quantity - 1})">-</button>
          <span>${item.quantity}</span>
          <button onclick="updateCartQuantity(${item.menu_id}, ${item.quantity + 1})">+</button>
        </td>
        <td>₹${item.total_price}</td>
        <td>${addedAt}</td>
        <td>
          <button onclick="removeCartItem(${item.menu_id})" class="remove-btn">🗑 Remove</button>
        </td>
      </tr>
    `;
    cartBody.innerHTML += row;
  });

  totalAmountEl.textContent = totalAmount.toFixed(2);
}

// Update cart quantity (+ or -)
async function updateCartQuantity(menu_id, newQuantity) {
  try {
    const response = await fetch(`${API_URL}/cart/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        table_id: TABLE_ID,
        menu_id: menu_id,
        quantity: newQuantity
      })
    });

    const result = await response.json();

    if (response.ok) {
      fetchCart(); // Refresh cart
    } else {
      alert(result.message || "Failed to update quantity");
    }
  } catch (error) {
    console.error("Error updating cart:", error);
    alert("Error updating cart. Check console.");
  }
}

// Remove item from cart
async function removeCartItem(menu_id) {
  try {
    const response = await fetch(`${API_URL}/cart/remove/${TABLE_ID}/${menu_id}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (response.ok) {
      alert(result.message || "Item removed from cart!");
      fetchCart(); // Refresh cart
    } else {
      alert(result.message || "Failed to remove item");
    }
  } catch (error) {
    console.error("Error removing cart item:", error);
    alert("Error removing item. Check console.");
  }
}

// Place Order
async function placeOrder() {
  try {
    const response = await fetch(`${API_URL}/order/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        table_id: TABLE_ID,
        payment_mode: "Cash" // Can make dynamic later
      }),
    });

    const data = await response.json();

    if (response.ok) {
      alert(`Order placed successfully! Order ID: ${data.order_id}`);
      fetchCart(); // Refresh cart after placing order
    } else {
      alert(data.message || "Failed to place order");
    }
  } catch (error) {
    console.error("Error placing order:", error);
    alert("Error placing order. Check console.");
  }
}

// ======================
// 3. ORDERS PAGE FUNCTIONS
// ======================

// Fetch Orders
async function fetchOrders() {
  try {
    const response = await fetch(`${API_URL}/orders/${TABLE_ID}`);
    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Failed to fetch orders");
      return;
    }

    displayOrders(data);
  } catch (error) {
    console.error("Error fetching orders:", error);
    alert("Could not load orders. Check console.");
  }
}

// Display Orders
function displayOrders(orders) {
  const ordersBody = document.getElementById("ordersBody");
  if (!ordersBody) return;

  ordersBody.innerHTML = "";

  if (!orders || orders.length === 0) {
    ordersBody.innerHTML = `<tr><td colspan="6">No orders found.</td></tr>`;
    return;
  }

  orders.forEach(order => {
    const row = `
      <tr>
        <td>${order.order_id}</td>
        <td>₹${order.total_amount}</td>
        <td>${order.status || 'N/A'}</td>
        <td>${order.payment_method || 'N/A'}</td>
        <td>${order.payment_status || 'Pending'}</td>
        <td>${new Date(order.order_time || order.created_at).toLocaleString()}</td>
      </tr>
    `;
    ordersBody.innerHTML += row;
  });
}

// ======================
// AUTO DETECTION: PAGE LOAD
// ======================
window.onload = function () {
  if (document.getElementById("menu-container")) fetchMenu();
  if (document.getElementById("cartBody")) fetchCart();
  if (document.getElementById("ordersBody")) fetchOrders();
};
