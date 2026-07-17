# 🍔 Foodie Express — Food Ordering System
> College Project | Flask + MySQL + Vanilla JS

---

## 📁 Project Structure

```
food_ordering/
├── app.py                  ← Flask backend (all REST APIs)
├── requirements.txt        ← Python dependencies
├── database.sql            ← MySQL schema + sample data
├── README.md               ← This file
├── templates/
│   └── index.html          ← Single-page frontend shell
└── static/
    ├── css/
    │   └── style.css       ← All styles
    └── js/
        └── app.js          ← Frontend logic & API calls
```

---

## ⚙️ Setup Instructions (Step by Step)

### Step 1 — Prerequisites
Install the following:
- Python 3.10 or higher → https://python.org
- MySQL 8.x             → https://dev.mysql.com/downloads/
- pip (comes with Python)

---

### Step 2 — Set Up the Database

1. Open MySQL Workbench or MySQL CLI:
   ```bash
   mysql -u root -p
   ```

2. Run the schema file:
   ```sql
   SOURCE /path/to/food_ordering/database.sql;
   ```
   This creates the database, all tables, and inserts sample data.

3. Verify:
   ```sql
   USE food_ordering_db;
   SHOW TABLES;
   SELECT * FROM menu_items LIMIT 3;
   ```

---

### Step 3 — Configure Database Password

Open `app.py` and find this block (~line 20):
```python
def get_db():
    return mysql.connector.connect(
        host     = os.getenv('DB_HOST',     'localhost'),
        user     = os.getenv('DB_USER',     'root'),
        password = os.getenv('DB_PASSWORD', ''),    ← set your MySQL password here
        database = os.getenv('DB_NAME',     'food_ordering_db')
    )
```

Either:
- Edit the default string `''` to your MySQL password, OR
- Set environment variables:  
  `set DB_PASSWORD=yourpassword` (Windows)  
  `export DB_PASSWORD=yourpassword` (Mac/Linux)

---

### Step 4 — Install Python Dependencies

```bash
cd food_ordering
pip install -r requirements.txt
```

This installs Flask, Flask-CORS, mysql-connector-python, and bcrypt.

---

### Step 5 — Run the Application

```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

Open your browser and go to: **http://localhost:5000**

---

## 🔐 Test Credentials

| Role  | Email               | Password  |
|-------|---------------------|-----------|
| Admin | admin@foodie.com    | admin123  |
| User  | Register a new one  | any 6+ chars |

---

## 🗺️ API Reference

### Auth
| Method | Endpoint        | Description           |
|--------|-----------------|-----------------------|
| POST   | /api/register   | Register new user     |
| POST   | /api/login      | Login                 |
| POST   | /api/logout     | Logout                |
| GET    | /api/me         | Current user info     |

### Menu
| Method | Endpoint            | Description                  |
|--------|---------------------|------------------------------|
| GET    | /api/menu           | All items (?category=&search=)|
| GET    | /api/menu/<id>      | Single item                  |

### Cart
| Method | Endpoint            | Description           |
|--------|---------------------|-----------------------|
| GET    | /api/cart           | View cart             |
| POST   | /api/cart           | Add item              |
| PUT    | /api/cart/<item_id> | Update quantity       |
| DELETE | /api/cart/<item_id> | Remove item           |
| DELETE | /api/cart/clear     | Clear entire cart     |

### Orders
| Method | Endpoint     | Description       |
|--------|--------------|-------------------|
| POST   | /api/orders  | Place order       |
| GET    | /api/orders  | My order history  |

### Admin (role=admin required)
| Method | Endpoint                         | Description         |
|--------|----------------------------------|---------------------|
| POST   | /api/admin/menu                  | Add menu item       |
| PUT    | /api/admin/menu/<id>             | Update menu item    |
| DELETE | /api/admin/menu/<id>             | Delete menu item    |
| GET    | /api/admin/orders                | All orders          |
| PUT    | /api/admin/orders/<id>/status    | Update order status |

---

## 🗄️ Database Schema (ER Summary)

```
users          1 ──< cart         >── 1  menu_items
               1 ──< orders
               1 ──< order_details >── 1  menu_items
orders         1 ──< order_details
```

**Tables:**
- `users`         — id, name, email, password, phone, address, role
- `menu_items`    — id, name, description, price, category, image_url, is_available
- `cart`          — id, user_id, item_id, quantity
- `orders`        — id, user_id, total_amount, status, delivery_address, payment_method
- `order_details` — id, order_id, item_id, quantity, unit_price

---

## ✨ Features

- ✅ User registration & login (bcrypt hashed passwords)
- ✅ Browse & search food menu
- ✅ Filter by category
- ✅ Add / update / remove cart items
- ✅ Checkout with delivery address & payment method
- ✅ Order history with status badges
- ✅ Admin panel — manage menu items & update order status
- ✅ Responsive design (mobile + desktop)
- ✅ Session-based authentication

---

## 🚀 Tech Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | HTML5, CSS3, Vanilla JS  |
| Backend  | Python 3, Flask          |
| Database | MySQL 8                  |
| Auth     | Flask sessions + bcrypt  |
| Fonts    | Google Fonts (Playfair + DM Sans) |

---

## 📝 Notes for Submission

- All passwords stored as **bcrypt hashes** — never plain text
- REST API returns consistent `{success, message, data}` JSON
- Database uses **foreign keys** for referential integrity
- Frontend is a **Single Page Application** (no page reloads)
- CORS enabled for local development
