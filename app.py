# ============================================================
# Food Ordering System - Flask Backend (app.py)
# College Project
# Run: python app.py
# ============================================================

from dotenv import load_dotenv
from flask import Flask, request, jsonify, session
from flask_cors import CORS
import mysql.connector
import bcrypt
import os


def load_dotenv():
    """Load key=value pairs from a local .env file if present."""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if not os.path.exists(env_path):
        return

    with open(env_path, 'r', encoding='utf-8') as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value




load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.getenv("SECRET_KEY")
CORS(app, supports_credentials=True)

# ============================================================
# DATABASE CONNECTION HELPER
# ============================================================
def get_db():
    """Return a new MySQL connection using env vars or defaults."""
    return mysql.connector.connect(
        host     = os.getenv('DB_HOST',     'localhost'),
        user     = os.getenv('DB_USER',     'root'),
        password = os.getenv('DB_PASSWORD', ''),          # set your MySQL password
        database = os.getenv('DB_NAME',     'food_ordering_db')
    )

# ============================================================
# HELPER: send consistent JSON responses
# ============================================================
def ok(data=None, msg='Success', code=200):
    return jsonify({'success': True,  'message': msg, 'data': data}), code

def err(msg='Error', code=400):
    return jsonify({'success': False, 'message': msg}),             code


@app.errorhandler(mysql.connector.Error)
def handle_db_error(ex):
    """Return JSON for DB errors so frontend can show actionable messages."""
    return err(f'Database error: {ex.msg}', 500)


def sync_admin_seed_user():
    """Ensure demo admin account exists with a valid bcrypt hash."""
    admin_hash = '$2b$12$lv7Ung.0SrS71TwSSaTATui4jlpBCz84/S2ezLv1MEc1is9v48o66'  # admin123
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            '''INSERT INTO users (name, email, password, role)
               VALUES (%s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                   name = VALUES(name),
                   password = VALUES(password),
                   role = 'admin' ''',
            ('Admin', 'admin@foodie.com', admin_hash, 'admin')
        )
        db.commit()
    finally:
        cur.close(); db.close()

# ============================================================
# AUTH ROUTES
# ============================================================

@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user."""
    body = request.json or {}
    name     = (body.get('name')     or '').strip()
    email    = (body.get('email')    or '').strip().lower()
    password = (body.get('password') or '').strip()
    phone    = (body.get('phone')    or '').strip()

    if not name or not email or not password:
        return err('Name, email and password are required.')

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute(
            'INSERT INTO users (name, email, password, phone) VALUES (%s,%s,%s,%s)',
            (name, email, hashed, phone)
        )
        db.commit()
        user_id = cur.lastrowid
        session['user_id'] = user_id
        session['role']    = 'user'
        return ok({'id': user_id, 'name': name, 'email': email, 'role': 'user'},
                  'Registration successful!', 201)
    except mysql.connector.IntegrityError:
        return err('Email already registered.')
    finally:
        cur.close(); db.close()


@app.route('/api/login', methods=['POST'])
def login():
    """Authenticate a user and start a session."""
    body = request.json or {}
    email    = (body.get('email')    or '').strip().lower()
    password = (body.get('password') or '').strip()

    if not email or not password:
        return err('Email and password are required.')

    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cur.fetchone()
        if not user or not bcrypt.checkpw(password.encode(), user['password'].encode()):
            return err('Invalid email or password.', 401)

        session['user_id'] = user['id']
        session['role']    = user['role']
        return ok({'id': user['id'], 'name': user['name'],
                   'email': user['email'], 'role': user['role']}, 'Login successful!')
    finally:
        cur.close(); db.close()


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return ok(msg='Logged out.')


@app.route('/api/me', methods=['GET'])
def me():
    """Return current logged-in user info."""
    if 'user_id' not in session:
        return err('Not logged in.', 401)
    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute(
            'SELECT id, name, email, phone, address, role FROM users WHERE id = %s',
            (session['user_id'],)
        )
        user = cur.fetchone()
        return ok(user) if user else err('User not found.', 404)
    finally:
        cur.close(); db.close()

# ============================================================
# MENU ROUTES
# ============================================================

@app.route('/api/menu', methods=['GET'])
def get_menu():
    """Fetch all available menu items, optionally filtered by category or search."""
    category = request.args.get('category', '').strip()
    search   = request.args.get('search',   '').strip()

    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        query  = 'SELECT * FROM menu_items WHERE is_available = 1'
        params = []
        if category:
            query += ' AND category = %s'
            params.append(category)
        if search:
            query += ' AND (name LIKE %s OR description LIKE %s)'
            params += [f'%{search}%', f'%{search}%']
        query += ' ORDER BY category, name'
        cur.execute(query, params)
        items = cur.fetchall()

        # also return distinct categories for filter buttons
        cur.execute('SELECT DISTINCT category FROM menu_items WHERE is_available=1 ORDER BY category')
        categories = [r['category'] for r in cur.fetchall()]
        return ok({'items': items, 'categories': categories})
    finally:
        cur.close(); db.close()


@app.route('/api/menu/<int:item_id>', methods=['GET'])
def get_menu_item(item_id):
    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute('SELECT * FROM menu_items WHERE id = %s', (item_id,))
        item = cur.fetchone()
        return ok(item) if item else err('Item not found.', 404)
    finally:
        cur.close(); db.close()

# ============================================================
# CART ROUTES
# ============================================================

def require_login():
    if 'user_id' not in session:
        return err('Please log in first.', 401)
    return None


@app.route('/api/cart', methods=['GET'])
def get_cart():
    guard = require_login()
    if guard: return guard

    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute(
            '''SELECT c.id, c.quantity,
                      m.id AS item_id, m.name, m.price, m.image_url,
                      (m.price * c.quantity) AS subtotal
               FROM cart c
               JOIN menu_items m ON c.item_id = m.id
               WHERE c.user_id = %s''',
            (session['user_id'],)
        )
        cart   = cur.fetchall()
        total  = sum(float(r['subtotal']) for r in cart)
        return ok({'items': cart, 'total': round(total, 2)})
    finally:
        cur.close(); db.close()


@app.route('/api/cart', methods=['POST'])
def add_to_cart():
    guard = require_login()
    if guard: return guard

    body     = request.json or {}
    item_id  = body.get('item_id')
    quantity = int(body.get('quantity', 1))

    if not item_id or quantity < 1:
        return err('item_id and a positive quantity are required.')

    db  = get_db()
    cur = db.cursor()
    try:
        # If item already in cart, increase quantity; otherwise insert
        cur.execute(
            '''INSERT INTO cart (user_id, item_id, quantity) VALUES (%s,%s,%s)
               ON DUPLICATE KEY UPDATE quantity = quantity + %s''',
            (session['user_id'], item_id, quantity, quantity)
        )
        db.commit()
        return ok(msg='Item added to cart.')
    finally:
        cur.close(); db.close()


@app.route('/api/cart/<int:item_id>', methods=['PUT'])
def update_cart(item_id):
    guard = require_login()
    if guard: return guard

    body     = request.json or {}
    quantity = int(body.get('quantity', 1))

    if quantity < 1:
        return err('Quantity must be at least 1.')

    db  = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            'UPDATE cart SET quantity = %s WHERE user_id = %s AND item_id = %s',
            (quantity, session['user_id'], item_id)
        )
        db.commit()
        return ok(msg='Cart updated.')
    finally:
        cur.close(); db.close()


@app.route('/api/cart/<int:item_id>', methods=['DELETE'])
def remove_from_cart(item_id):
    guard = require_login()
    if guard: return guard

    db  = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            'DELETE FROM cart WHERE user_id = %s AND item_id = %s',
            (session['user_id'], item_id)
        )
        db.commit()
        return ok(msg='Item removed from cart.')
    finally:
        cur.close(); db.close()


@app.route('/api/cart/clear', methods=['DELETE'])
def clear_cart():
    guard = require_login()
    if guard: return guard

    db  = get_db()
    cur = db.cursor()
    try:
        cur.execute('DELETE FROM cart WHERE user_id = %s', (session['user_id'],))
        db.commit()
        return ok(msg='Cart cleared.')
    finally:
        cur.close(); db.close()

# ============================================================
# ORDER ROUTES
# ============================================================

@app.route('/api/orders', methods=['POST'])
def place_order():
    """Move cart items into a new order."""
    guard = require_login()
    if guard: return guard

    body             = request.json or {}
    delivery_address = (body.get('delivery_address') or '').strip()
    payment_method   = (body.get('payment_method')   or 'Cash on Delivery').strip()

    if not delivery_address:
        return err('Delivery address is required.')

    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        # Fetch cart
        cur.execute(
            '''SELECT c.quantity, m.price, m.id AS item_id
               FROM cart c JOIN menu_items m ON c.item_id = m.id
               WHERE c.user_id = %s''',
            (session['user_id'],)
        )
        cart = cur.fetchall()
        if not cart:
            return err('Your cart is empty.')

        total = sum(float(r['price']) * r['quantity'] for r in cart)

        # Insert order header
        cur2 = db.cursor()
        cur2.execute(
            '''INSERT INTO orders (user_id, total_amount, delivery_address, payment_method)
               VALUES (%s,%s,%s,%s)''',
            (session['user_id'], total, delivery_address, payment_method)
        )
        order_id = cur2.lastrowid

        # Insert order detail lines
        for item in cart:
            cur2.execute(
                'INSERT INTO order_details (order_id, item_id, quantity, unit_price) VALUES (%s,%s,%s,%s)',
                (order_id, item['item_id'], item['quantity'], item['price'])
            )

        # Clear cart
        cur2.execute('DELETE FROM cart WHERE user_id = %s', (session['user_id'],))
        db.commit()
        cur2.close()

        return ok({'order_id': order_id, 'total': round(total, 2)},
                  'Order placed successfully!', 201)
    finally:
        cur.close(); db.close()


@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Fetch order history for the logged-in user."""
    guard = require_login()
    if guard: return guard

    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute(
            '''SELECT o.id, o.total_amount, o.status,
                      o.delivery_address, o.payment_method, o.created_at
               FROM orders o WHERE o.user_id = %s
               ORDER BY o.created_at DESC''',
            (session['user_id'],)
        )
        orders = cur.fetchall()

        # attach items to each order
        for order in orders:
            cur.execute(
                '''SELECT m.name, od.quantity, od.unit_price,
                          (od.quantity * od.unit_price) AS subtotal
                   FROM order_details od
                   JOIN menu_items m ON od.item_id = m.id
                   WHERE od.order_id = %s''',
                (order['id'],)
            )
            order['items'] = cur.fetchall()
            # make datetime serialisable
            order['created_at'] = str(order['created_at'])

        return ok(orders)
    finally:
        cur.close(); db.close()

# ============================================================
# PROFILE ROUTES
# ============================================================

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    """Update name, phone, and address for the logged-in user."""
    guard = require_login()
    if guard: return guard

    body    = request.json or {}
    name    = (body.get('name')    or '').strip()
    phone   = (body.get('phone')   or '').strip()
    address = (body.get('address') or '').strip()

    if not name:
        return err('Name cannot be empty.')

    db  = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            'UPDATE users SET name=%s, phone=%s, address=%s WHERE id=%s',
            (name, phone, address, session['user_id'])
        )
        db.commit()
        return ok(msg='Profile updated.')
    finally:
        cur.close(); db.close()


@app.route('/api/profile/password', methods=['PUT'])
def change_password():
    """Change password after verifying the current one."""
    guard = require_login()
    if guard: return guard

    body         = request.json or {}
    current_pw   = (body.get('current_password') or '').strip()
    new_pw       = (body.get('new_password')      or '').strip()

    if not current_pw or not new_pw:
        return err('Both current and new password are required.')
    if len(new_pw) < 6:
        return err('New password must be at least 6 characters.')

    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute('SELECT password FROM users WHERE id=%s', (session['user_id'],))
        row = cur.fetchone()
        if not row or not bcrypt.checkpw(current_pw.encode(), row['password'].encode()):
            return err('Current password is incorrect.', 401)

        new_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
        cur2 = db.cursor()
        cur2.execute('UPDATE users SET password=%s WHERE id=%s', (new_hash, session['user_id']))
        db.commit()
        cur2.close()
        return ok(msg='Password changed successfully.')
    finally:
        cur.close(); db.close()


# ============================================================
# ADMIN ROUTES (role = 'admin' required)
# ============================================================

def require_admin():
    if session.get('role') != 'admin':
        return err('Admin access required.', 403)
    return None


@app.route('/api/admin/menu', methods=['POST'])
def admin_add_item():
    guard = require_admin()
    if guard: return guard

    body = request.json or {}
    required = ['name', 'price', 'category']
    if not all(body.get(f) for f in required):
        return err('name, price, and category are required.')

    db  = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            '''INSERT INTO menu_items (name, description, price, category, image_url)
               VALUES (%s,%s,%s,%s,%s)''',
            (body['name'], body.get('description',''),
             body['price'], body['category'], body.get('image_url',''))
        )
        db.commit()
        return ok({'id': cur.lastrowid}, 'Menu item added.', 201)
    finally:
        cur.close(); db.close()


@app.route('/api/admin/menu/<int:item_id>', methods=['PUT'])
def admin_update_item(item_id):
    guard = require_admin()
    if guard: return guard

    body = request.json or {}
    db   = get_db()
    cur  = db.cursor()
    try:
        cur.execute(
            '''UPDATE menu_items
               SET name=%s, description=%s, price=%s,
                   category=%s, image_url=%s, is_available=%s
               WHERE id=%s''',
            (body.get('name'), body.get('description'), body.get('price'),
             body.get('category'), body.get('image_url'),
             int(body.get('is_available', 1)), item_id)
        )
        db.commit()
        return ok(msg='Menu item updated.')
    finally:
        cur.close(); db.close()


@app.route('/api/admin/menu/<int:item_id>', methods=['DELETE'])
def admin_delete_item(item_id):
    guard = require_admin()
    if guard: return guard

    db  = get_db()
    cur = db.cursor()
    try:
        cur.execute('DELETE FROM menu_items WHERE id = %s', (item_id,))
        db.commit()
        return ok(msg='Menu item deleted.')
    finally:
        cur.close(); db.close()


@app.route('/api/admin/orders', methods=['GET'])
def admin_get_orders():
    guard = require_admin()
    if guard: return guard

    db  = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute(
            '''SELECT o.*, u.name AS user_name, u.email AS user_email
               FROM orders o JOIN users u ON o.user_id = u.id
               ORDER BY o.created_at DESC'''
        )
        orders = cur.fetchall()
        for o in orders:
            o['created_at'] = str(o['created_at'])
        return ok(orders)
    finally:
        cur.close(); db.close()


@app.route('/api/admin/orders/<int:order_id>/status', methods=['PUT'])
def admin_update_status(order_id):
    guard = require_admin()
    if guard: return guard

    status = (request.json or {}).get('status','').strip()
    valid  = {'pending','confirmed','preparing','delivered','cancelled'}
    if status not in valid:
        return err(f'Status must be one of: {", ".join(valid)}')

    db  = get_db()
    cur = db.cursor()
    try:
        cur.execute('UPDATE orders SET status=%s WHERE id=%s', (status, order_id))
        db.commit()
        return ok(msg='Order status updated.')
    finally:
        cur.close(); db.close()

# ============================================================
# SERVE FRONTEND
# ============================================================

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    from flask import send_from_directory, render_template
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    # serve the single-page app shell
    return render_template('index.html')


# ============================================================
if __name__ == '__main__':
    try:
        sync_admin_seed_user()
    except Exception as ex:
        print(f'[WARN] Admin seed sync failed: {ex}')
    app.run(debug=True, port=5000)