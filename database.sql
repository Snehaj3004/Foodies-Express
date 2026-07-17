-- ============================================================
-- Food Ordering System - MySQL Database Schema
-- College Project | Run this file in MySQL to set up the DB
-- ============================================================

-- Create and select the database
CREATE DATABASE IF NOT EXISTS food_ordering_db;
USE food_ordering_db;

-- ============================================================
-- TABLE: users
-- Stores registered user information
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)        NOT NULL,
    email       VARCHAR(150)        NOT NULL UNIQUE,
    password    VARCHAR(255)        NOT NULL,   -- stored as bcrypt hash
    phone       VARCHAR(15),
    address     TEXT,
    role        ENUM('user','admin') DEFAULT 'user',
    created_at  TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: menu_items
-- Stores all food items available for ordering
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150)        NOT NULL,
    description TEXT,
    price       DECIMAL(8,2)        NOT NULL,
    category    VARCHAR(80)         NOT NULL,   -- e.g. Burgers, Pizza, Drinks
    image_url   VARCHAR(300),
    is_available TINYINT(1)         DEFAULT 1,  -- 1 = available, 0 = not available
    created_at  TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: cart
-- Stores items currently in a user's cart (session-based)
-- ============================================================
CREATE TABLE IF NOT EXISTS cart (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT                 NOT NULL,
    item_id     INT                 NOT NULL,
    quantity    INT                 NOT NULL DEFAULT 1,
    added_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)       ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES menu_items(id)  ON DELETE CASCADE,
    UNIQUE KEY unique_cart_item (user_id, item_id)   -- prevent duplicate rows
);

-- ============================================================
-- TABLE: orders
-- Stores each placed order (header record)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    total_amount    DECIMAL(10,2)   NOT NULL,
    status          ENUM('pending','confirmed','preparing','delivered','cancelled')
                                    DEFAULT 'pending',
    delivery_address TEXT,
    payment_method  VARCHAR(50)     DEFAULT 'Cash on Delivery',
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: order_details
-- Stores line items for each order (normalised)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_details (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT             NOT NULL,
    item_id     INT             NOT NULL,
    quantity    INT             NOT NULL,
    unit_price  DECIMAL(8,2)   NOT NULL,   -- price at time of order
    FOREIGN KEY (order_id) REFERENCES orders(id)      ON DELETE CASCADE,
    FOREIGN KEY (item_id)  REFERENCES menu_items(id)  ON DELETE CASCADE
);

-- ============================================================
-- SAMPLE DATA: admin user  (password = "admin123")
-- ============================================================
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@foodie.com',
 '$2b$12$lv7Ung.0SrS71TwSSaTATui4jlpBCz84/S2ezLv1MEc1is9v48o66',
 'admin')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    password = VALUES(password),
    role = 'admin';

-- ============================================================
-- SAMPLE DATA: menu items
-- ============================================================
INSERT INTO menu_items (name, description, price, category, image_url) VALUES
-- Burgers
('Classic Beef Burger',    'Juicy beef patty with lettuce, tomato & special sauce', 149.00, 'Burgers',  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'),
('Chicken Zinger Burger',  'Crispy fried chicken with jalapeños & cheese',          139.00, 'Burgers',  'https://images.unsplash.com/photo-1561758033-7e924f619b47?w=400'),
('Veggie Burger',          'Grilled veggie patty with avocado & sriracha',          119.00, 'Burgers',  'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400'),
-- Pizza
('Margherita Pizza',       'Classic tomato, mozzarella & fresh basil',              199.00, 'Pizza',    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400'),
('Pepperoni Pizza',        'Loaded pepperoni with three-cheese blend',              229.00, 'Pizza',    'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400'),
('BBQ Chicken Pizza',      'Smoky BBQ sauce, chicken, onions & coriander',          219.00, 'Pizza',    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400'),
-- Pasta
('Spaghetti Bolognese',    'Rich meat sauce slow-cooked with herbs',                179.00, 'Pasta',    'https://images.unsplash.com/photo-1633337474564-1d9478ca4e2e?w=400'),
('Penne Arrabbiata',       'Spicy tomato sauce, garlic & parsley',                  159.00, 'Pasta',    'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=400'),
-- Drinks
('Fresh Lemonade',         'Freshly squeezed lemon with mint',                       59.00, 'Drinks',   'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400'),
('Mango Lassi',            'Chilled mango yoghurt smoothie',                         69.00, 'Drinks',   'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400'),
('Chocolate Milkshake',    'Thick creamy chocolate milkshake',                       89.00, 'Drinks',   'https://images.unsplash.com/photo-1572490122747-3e9a6b65d54a?w=400'),
-- Desserts
('Chocolate Lava Cake',    'Warm molten chocolate cake with vanilla ice cream',     129.00, 'Desserts', 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400'),
('Mango Cheesecake',       'Creamy baked cheesecake with mango compote',            119.00, 'Desserts', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400');

-- ============================================================
-- USEFUL QUERIES FOR REFERENCE
-- ============================================================

-- Fetch full menu grouped by category
-- SELECT category, id, name, description, price, image_url
-- FROM menu_items WHERE is_available = 1 ORDER BY category, name;

-- Fetch a user's cart with item details
-- SELECT c.id, m.name, m.price, c.quantity, (m.price * c.quantity) AS subtotal
-- FROM cart c JOIN menu_items m ON c.item_id = m.id
-- WHERE c.user_id = ?;

-- Fetch order history for a user
-- SELECT o.id, o.total_amount, o.status, o.created_at,
--        GROUP_CONCAT(m.name ORDER BY m.name SEPARATOR ', ') AS items
-- FROM orders o
-- JOIN order_details od ON o.id = od.order_id
-- JOIN menu_items m     ON od.item_id = m.id
-- WHERE o.user_id = ?
-- GROUP BY o.id ORDER BY o.created_at DESC;
