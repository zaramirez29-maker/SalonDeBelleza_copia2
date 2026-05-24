import pymysql
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURACIÓN DEL SERVIDOR ---
app = Flask(__name__)
CORS(app)

# -------------------------------------------------------
# CONEXIÓN A MYSQL
# -------------------------------------------------------
def get_db_connection():
    """Conecta a MySQL y retorna filas como diccionarios."""
    conn = pymysql.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'salondb'),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    return conn

# -------------------------------------------------------
# HEALTH CHECK
# -------------------------------------------------------
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Backend MySQL is running"}), 200

# -------------------------------------------------------
# AUTENTICACIÓN
# -------------------------------------------------------
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                'SELECT * FROM users WHERE username = %s AND password = %s',
                (username, password)
            )
            user = cursor.fetchone()
    finally:
        conn.close()

    if user:
        return jsonify({
            "status": "success",
            "user": {"id": user['id'], "username": user['username'], "role": user['role']}
        })
    else:
        return jsonify({"status": "error", "message": "Credenciales inválidas"}), 401

# -------------------------------------------------------
# DASHBOARD / ESTADÍSTICAS
# -------------------------------------------------------
@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) as cnt FROM clients')
            clients_count = cursor.fetchone()['cnt']

            cursor.execute('SELECT COUNT(*) as cnt FROM employees')
            employees_count = cursor.fetchone()['cnt']

            cursor.execute('SELECT COUNT(*) as cnt FROM services')
            services_count = cursor.fetchone()['cnt']

            cursor.execute("SELECT SUM(total) as total FROM sales WHERE DATE(date) = CURDATE()")
            today_income = cursor.fetchone()['total'] or 0.0

            cursor.execute('SELECT COUNT(*) as cnt FROM products WHERE stock <= 5')
            low_stock = cursor.fetchone()['cnt']
    finally:
        conn.close()

    return jsonify({
        "clients_count": clients_count,
        "employees_count": employees_count,
        "services_count": services_count,
        "today_income": float(today_income),
        "low_stock": low_stock,
    })

# -------------------------------------------------------
# CLIENTES
# -------------------------------------------------------
@app.route('/api/clients', methods=['GET', 'POST'])
def handle_clients():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute('SELECT * FROM clients ORDER BY name ASC')
                rows = cursor.fetchall()
                return jsonify(rows)

            if request.method == 'POST':
                data = request.json
                cursor.execute(
                    'INSERT INTO clients (name, phone, email, notes) VALUES (%s, %s, %s, %s)',
                    (data['name'], data.get('phone', ''), data.get('email', ''), data.get('notes', ''))
                )
                conn.commit()
                return jsonify({"message": "Cliente registrado"}), 201
    finally:
        conn.close()

@app.route('/api/clients/<int:id>', methods=['PUT', 'DELETE'])
def manage_client(id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'PUT':
                data = request.json
                cursor.execute(
                    'UPDATE clients SET name=%s, phone=%s, email=%s, notes=%s WHERE id=%s',
                    (data['name'], data.get('phone', ''), data.get('email', ''), data.get('notes', ''), id)
                )
                conn.commit()
                return jsonify({"message": "Cliente actualizado"}), 200

            if request.method == 'DELETE':
                cursor.execute('DELETE FROM clients WHERE id=%s', (id,))
                conn.commit()
                return jsonify({"message": "Cliente eliminado"}), 200
    finally:
        conn.close()

# -------------------------------------------------------
# EMPLEADOS
# -------------------------------------------------------
@app.route('/api/employees', methods=['GET', 'POST'])
def handle_employees():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute('SELECT * FROM employees')
                return jsonify(cursor.fetchall())

            if request.method == 'POST':
                data = request.json
                cursor.execute(
                    'INSERT INTO employees (name, specialty, phone, commission) VALUES (%s, %s, %s, %s)',
                    (data['name'], data.get('specialty', ''), data.get('phone', ''), data.get('commission', 10.0))
                )
                conn.commit()
                return jsonify({"message": "Empleado registrado"}), 201
    finally:
        conn.close()

@app.route('/api/employees/<int:id>', methods=['PUT', 'DELETE'])
def manage_employee(id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'PUT':
                data = request.json
                cursor.execute(
                    'UPDATE employees SET name=%s, specialty=%s, phone=%s, commission=%s WHERE id=%s',
                    (data['name'], data.get('specialty', ''), data.get('phone', ''), data.get('commission', 10.0), id)
                )
                conn.commit()
                return jsonify({"message": "Empleado actualizado"}), 200

            if request.method == 'DELETE':
                cursor.execute('DELETE FROM employees WHERE id=%s', (id,))
                conn.commit()
                return jsonify({"message": "Empleado eliminado"}), 200
    finally:
        conn.close()

# -------------------------------------------------------
# SERVICIOS
# -------------------------------------------------------
@app.route('/api/services', methods=['GET', 'POST'])
def handle_services():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute('SELECT * FROM services')
                return jsonify(cursor.fetchall())

            if request.method == 'POST':
                data = request.json
                cursor.execute(
                    'INSERT INTO services (name, price, category) VALUES (%s, %s, %s)',
                    (data['name'], data['price'], data.get('category', ''))
                )
                conn.commit()
                return jsonify({"message": "Servicio registrado"}), 201
    finally:
        conn.close()

@app.route('/api/services/<int:id>', methods=['PUT', 'DELETE'])
def manage_service(id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'PUT':
                data = request.json
                cursor.execute(
                    'UPDATE services SET name=%s, price=%s, category=%s WHERE id=%s',
                    (data['name'], data['price'], data.get('category', ''), id)
                )
                conn.commit()
                return jsonify({"message": "Servicio actualizado"}), 200

            if request.method == 'DELETE':
                cursor.execute('DELETE FROM services WHERE id=%s', (id,))
                conn.commit()
                return jsonify({"message": "Servicio eliminado"}), 200
    finally:
        conn.close()

# -------------------------------------------------------
# PRODUCTOS
# -------------------------------------------------------
@app.route('/api/products', methods=['GET', 'POST'])
def handle_products():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute('SELECT * FROM products')
                return jsonify(cursor.fetchall())

            if request.method == 'POST':
                data = request.json
                cursor.execute(
                    'INSERT INTO products (name, brand, category, price, stock) VALUES (%s, %s, %s, %s, %s)',
                    (data['name'], data.get('brand', ''), data.get('category', ''), data['price'], data.get('stock', 0))
                )
                conn.commit()
                return jsonify({"message": "Producto registrado"}), 201
    finally:
        conn.close()

@app.route('/api/products/<int:id>', methods=['PUT', 'DELETE'])
def manage_product(id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'PUT':
                data = request.json
                cursor.execute(
                    'UPDATE products SET name=%s, brand=%s, category=%s, price=%s, stock=%s WHERE id=%s',
                    (data['name'], data.get('brand', ''), data.get('category', ''), data['price'], data.get('stock', 0), id)
                )
                conn.commit()
                return jsonify({"message": "Producto actualizado"}), 200

            if request.method == 'DELETE':
                cursor.execute('DELETE FROM products WHERE id=%s', (id,))
                conn.commit()
                return jsonify({"message": "Producto eliminado"}), 200
    finally:
        conn.close()

# -------------------------------------------------------
# CITAS
# -------------------------------------------------------
@app.route('/api/appointments', methods=['GET', 'POST'])
def handle_appointments():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute('''
                    SELECT a.*,
                           c.name as client_name,
                           e.name as employee_name,
                           s.name as service_name
                    FROM appointments a
                    LEFT JOIN clients c ON a.client_id = c.id
                    LEFT JOIN employees e ON a.employee_id = e.id
                    LEFT JOIN services s ON a.service_id = s.id
                    ORDER BY a.date DESC, a.time DESC
                ''')
                rows = cursor.fetchall()
                # Convertir date/time a string para JSON
                for row in rows:
                    if row.get('date'):
                        row['date'] = str(row['date'])
                    if row.get('time') is not None:
                        row['time'] = str(row['time'])
                return jsonify(rows)

            if request.method == 'POST':
                data = request.json
                cursor.execute(
                    'INSERT INTO appointments (client_id, employee_id, service_id, date, time) VALUES (%s, %s, %s, %s, %s)',
                    (data['client_id'], data['employee_id'], data['service_id'], data['date'], data['time'])
                )
                conn.commit()
                return jsonify({"message": "Cita agendada"}), 201
    finally:
        conn.close()

@app.route('/api/appointments/<int:id>', methods=['PUT', 'DELETE'])
def manage_appointment(id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'PUT':
                data = request.json
                cursor.execute(
                    'UPDATE appointments SET client_id=%s, employee_id=%s, service_id=%s, date=%s, time=%s, status=%s WHERE id=%s',
                    (data.get('client_id'), data.get('employee_id'), data.get('service_id'),
                     data.get('date'), data.get('time'), data.get('status', 'Pendiente'), id)
                )
                conn.commit()
                return jsonify({"message": "Cita actualizada"}), 200

            if request.method == 'DELETE':
                cursor.execute('DELETE FROM appointments WHERE id=%s', (id,))
                conn.commit()
                return jsonify({"message": "Cita eliminada"}), 200
    finally:
        conn.close()

# -------------------------------------------------------
# VENTAS
# -------------------------------------------------------
@app.route('/api/sales', methods=['GET', 'POST'])
def handle_sales():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute('''
                    SELECT s.*, c.name as client_name
                    FROM sales s
                    LEFT JOIN clients c ON s.client_id = c.id
                    ORDER BY s.date DESC
                ''')
                rows = cursor.fetchall()
                for row in rows:
                    if row.get('date'):
                        row['date'] = str(row['date'])
                    if row.get('created_at'):
                        row['created_at'] = str(row['created_at'])
                    if row.get('total') is not None:
                        row['total'] = float(row['total'])
                    if row.get('subtotal') is not None:
                        row['subtotal'] = float(row['subtotal'])
                return jsonify(rows)

            if request.method == 'POST':
                data = request.json
                cursor.execute(
                    'INSERT INTO sales (client_id, total, payment_method, processed_by) VALUES (%s, %s, %s, %s)',
                    (data.get('client_id'), data['total'], data['payment_method'], data.get('processed_by', ''))
                )
                conn.commit()
                return jsonify({"message": "Venta procesada"}), 201
    finally:
        conn.close()

@app.route('/api/sales/<int:id>', methods=['PUT', 'DELETE'])
def manage_sale(id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'PUT':
                data = request.json
                cursor.execute(
                    'UPDATE sales SET client_id=%s, total=%s, payment_method=%s WHERE id=%s',
                    (data.get('client_id'), data['total'], data['payment_method'], id)
                )
                conn.commit()
                return jsonify({"message": "Venta actualizada"}), 200

            if request.method == 'DELETE':
                cursor.execute('DELETE FROM sales WHERE id=%s', (id,))
                conn.commit()
                return jsonify({"message": "Venta eliminada"}), 200
    finally:
        conn.close()

@app.route('/api/sales_detailed', methods=['POST'])
def create_detailed_sale():
    """Crea una venta con detalles completos."""
    data = request.json
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('''
                INSERT INTO sales
                    (client_id, total, payment_method, payment_detail, subtotal,
                     discount_amount, promotion_title, promotion_discount,
                     employee_id, appointment_id, created_by_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                data.get('client_id'), data['total'], data['payment_method'],
                data.get('payment_detail'), data.get('subtotal'),
                data.get('discount_amount', 0), data.get('promotion_title'),
                data.get('promotion_discount', 0), data.get('employee_id'),
                data.get('appointment_id'), data.get('created_by_id')
            ))
            sale_id = cursor.lastrowid
            conn.commit()
        return jsonify({"id": sale_id, "message": "Venta procesada"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()

# -------------------------------------------------------
# PROMOCIONES
# -------------------------------------------------------
@app.route('/api/promotions', methods=['GET', 'POST'])
def handle_promotions():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute('SELECT * FROM promotions')
                rows = cursor.fetchall()
                for row in rows:
                    if row.get('start_date'):
                        row['start_date'] = str(row['start_date'])
                    if row.get('end_date'):
                        row['end_date'] = str(row['end_date'])
                    if row.get('created_at'):
                        row['created_at'] = str(row['created_at'])
                return jsonify(rows)

            if request.method == 'POST':
                data = request.json
                cursor.execute(
                    'INSERT INTO promotions (title, discount_percent, start_date, end_date) VALUES (%s, %s, %s, %s)',
                    (data['title'], data['discount_percent'], data.get('start_date'), data.get('end_date'))
                )
                conn.commit()
                return jsonify({"message": "Promoción registrada"}), 201
    finally:
        conn.close()

@app.route('/api/promotions/<int:id>', methods=['PUT', 'DELETE'])
def manage_promotion(id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == 'PUT':
                data = request.json
                cursor.execute(
                    'UPDATE promotions SET title=%s, discount_percent=%s, start_date=%s, end_date=%s WHERE id=%s',
                    (data['title'], data['discount_percent'], data.get('start_date'), data.get('end_date'), id)
                )
                conn.commit()
                return jsonify({"message": "Promoción actualizada"}), 200

            if request.method == 'DELETE':
                cursor.execute('DELETE FROM promotions WHERE id=%s', (id,))
                conn.commit()
                return jsonify({"message": "Promoción eliminada"}), 200
    finally:
        conn.close()

# -------------------------------------------------------
# INICIO
# -------------------------------------------------------
if __name__ == '__main__':
    from database import init_db
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
