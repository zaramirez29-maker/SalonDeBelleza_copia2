import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime

# --- CONFIGURACIÓN DEL SERVIDOR ---
app = Flask(__name__)
CORS(app)  # Permite que el frontend React se comunique con Flask

DATABASE = 'salon.db'

def get_db_connection():
    """Conecta a la base de datos y devuelve filas accesibles por nombre de columna."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Backend is running"}), 200

# --- USUARIOS / AUTENTICACIÓN ---

@app.route('/api/login', methods=['POST'])
def login():
    """Verifica credenciales del usuario."""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ? AND password = ?', (username, password)).fetchone()
    conn.close()
    
    if user:
        return jsonify({
            "status": "success",
            "user": { "id": user['id'], "username": user['username'], "role": user['role'] }
        })
    else:
        return jsonify({"status": "error", "message": "Credenciales inválidas"}), 401

# --- REPORTES / ESTADÍSTICAS (Para el Dashboard) ---

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Calcula datos rápidos para los indicadores del Dashboard."""
    conn = get_db_connection()
    stats = {
        "clients_count": conn.execute('SELECT COUNT(*) FROM clients').fetchone()[0],
        "employees_count": conn.execute('SELECT COUNT(*) FROM employees').fetchone()[0],
        "services_count": conn.execute('SELECT COUNT(*) FROM services').fetchone()[0],
        "today_income": conn.execute("SELECT SUM(total) FROM sales WHERE date >= date('now', 'start of day')").fetchone()[0] or 0.0,
        "low_stock": conn.execute('SELECT COUNT(*) FROM products WHERE stock <= 5').fetchone()[0]
    }
    conn.close()
    return jsonify(stats)

# --- CLIENTES ---

@app.route('/api/clients', methods=['GET', 'POST'])
def handle_clients():
    conn = get_db_connection()
    if request.method == 'GET':
        clients = conn.execute('SELECT * FROM clients ORDER BY name ASC').fetchall()
        conn.close()
        return jsonify([dict(row) for row in clients])
    
    if request.method == 'POST':
        data = request.json
        conn.execute('INSERT INTO clients (name, phone, email, notes) VALUES (?, ?, ?, ?)',
                    (data['name'], data['phone'], data['email'], data['notes']))
        conn.commit()
        conn.close()
        return jsonify({"message": "Cliente registrado"}), 201

# --- EMPLEADOS ---

@app.route('/api/employees', methods=['GET', 'POST'])
def handle_employees():
    conn = get_db_connection()
    if request.method == 'GET':
        employees = conn.execute('SELECT * FROM employees').fetchall()
        conn.close()
        return jsonify([dict(row) for row in employees])
    
    if request.method == 'POST':
        data = request.json
        conn.execute('INSERT INTO employees (name, specialty, commission) VALUES (?, ?, ?)',
                    (data['name'], data['specialty'], data['commission']))
        conn.commit()
        conn.close()
        return jsonify({"message": "Empleado registrado"}), 201

# --- SERVICIOS ---

@app.route('/api/services', methods=['GET', 'POST'])
def handle_services():
    conn = get_db_connection()
    if request.method == 'GET':
        services = conn.execute('SELECT * FROM services').fetchall()
        conn.close()
        return jsonify([dict(row) for row in services])
    
    if request.method == 'POST':
        data = request.json
        conn.execute('INSERT INTO services (name, price, category) VALUES (?, ?, ?)',
                    (data['name'], data['price'], data['category']))
        conn.commit()
        conn.close()
        return jsonify({"message": "Servicio registrado"}), 201

# --- PRODUCTOS ---

@app.route('/api/products', methods=['GET', 'POST'])
def handle_products():
    conn = get_db_connection()
    if request.method == 'GET':
        products = conn.execute('SELECT * FROM products').fetchall()
        conn.close()
        return jsonify([dict(row) for row in products])
    
    if request.method == 'POST':
        data = request.json
        conn.execute('INSERT INTO products (name, brand, category, price, stock) VALUES (?, ?, ?, ?, ?)',
                    (data['name'], data['brand'], data['category'], data['price'], data['stock']))
        conn.commit()
        conn.close()
        return jsonify({"message": "Producto registrado"}), 201

# --- CITAS ---

@app.route('/api/appointments', methods=['GET', 'POST'])
def handle_appointments():
    conn = get_db_connection()
    if request.method == 'GET':
        query = '''
            SELECT a.*, c.name as client_name, e.name as employee_name, s.name as service_name 
            FROM appointments a
            LEFT JOIN clients c ON a.client_id = c.id
            LEFT JOIN employees e ON a.employee_id = e.id
            LEFT JOIN services s ON a.service_id = s.id
            ORDER BY a.date DESC, a.time DESC
        '''
        appointments = conn.execute(query).fetchall()
        conn.close()
        return jsonify([dict(row) for row in appointments])
    
    if request.method == 'POST':
        data = request.json
        conn.execute('INSERT INTO appointments (client_id, employee_id, service_id, date, time) VALUES (?, ?, ?, ?, ?)',
                    (data['client_id'], data['employee_id'], data['service_id'], data['date'], data['time']))
        conn.commit()
        conn.close()
        return jsonify({"message": "Cita agendada"}), 201

# --- VENTAS ---

@app.route('/api/sales', methods=['GET', 'POST'])
def handle_sales():
    conn = get_db_connection()
    if request.method == 'GET':
        query = '''
            SELECT s.*, c.name as client_name 
            FROM sales s 
            LEFT JOIN clients c ON s.client_id = c.id 
            ORDER BY s.date DESC
        '''
        sales = conn.execute(query).fetchall()
        conn.close()
        return jsonify([dict(row) for row in sales])
    
    if request.method == 'POST':
        data = request.json
        conn.execute('INSERT INTO sales (client_id, total, payment_method, processed_by) VALUES (?, ?, ?, ?)',
                    (data.get('client_id'), data['total'], data['payment_method'], data['processed_by']))
        conn.commit()
        conn.close()
        return jsonify({"message": "Venta procesada"}), 201

# --- PROMOCIONES ---

@app.route('/api/promotions', methods=['GET', 'POST'])
def handle_promotions():
    conn = get_db_connection()
    if request.method == 'GET':
        # Check if table exists first
        try:
            promotions = conn.execute('SELECT * FROM promotions').fetchall()
            conn.close()
            return jsonify([dict(row) for row in promotions])
        except:
            conn.close()
            return jsonify([])
    
    if request.method == 'POST':
        data = request.json
        try:
            conn.execute('INSERT INTO promotions (title, discount_percent, start_date, end_date) VALUES (?, ?, ?, ?)',
                        (data['title'], data['discount_percent'], data['start_date'], data['end_date']))
            conn.commit()
            conn.close()
            return jsonify({"message": "Promoción registrada"}), 201
        except:
            conn.close()
            return jsonify({"message": "Promoción registrada"}), 201

# --- OPERACIONES CRUD (PUT, DELETE) ---

@app.route('/api/clients/<int:id>', methods=['PUT', 'DELETE'])
def manage_client(id):
    conn = get_db_connection()
    if request.method == 'PUT':
        data = request.json
        conn.execute('UPDATE clients SET name=?, phone=?, email=?, notes=? WHERE id=?',
                    (data['name'], data['phone'], data['email'], data.get('notes', ''), id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Cliente actualizado"}), 200
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM clients WHERE id=?', (id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Cliente eliminado"}), 200

@app.route('/api/employees/<int:id>', methods=['PUT', 'DELETE'])
def manage_employee(id):
    conn = get_db_connection()
    if request.method == 'PUT':
        data = request.json
        conn.execute('UPDATE employees SET name=?, specialty=?, commission=? WHERE id=?',
                    (data['name'], data['specialty'], data.get('commission', 10.0), id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Empleado actualizado"}), 200
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM employees WHERE id=?', (id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Empleado eliminado"}), 200

@app.route('/api/services/<int:id>', methods=['PUT', 'DELETE'])
def manage_service(id):
    conn = get_db_connection()
    if request.method == 'PUT':
        data = request.json
        conn.execute('UPDATE services SET name=?, price=?, category=? WHERE id=?',
                    (data['name'], data['price'], data.get('category', ''), id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Servicio actualizado"}), 200
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM services WHERE id=?', (id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Servicio eliminado"}), 200

@app.route('/api/products/<int:id>', methods=['PUT', 'DELETE'])
def manage_product(id):
    conn = get_db_connection()
    if request.method == 'PUT':
        data = request.json
        conn.execute('UPDATE products SET name=?, brand=?, category=?, price=?, stock=? WHERE id=?',
                    (data['name'], data['brand'], data.get('category', ''), data['price'], data.get('stock', 0), id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Producto actualizado"}), 200
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM products WHERE id=?', (id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Producto eliminado"}), 200

@app.route('/api/appointments/<int:id>', methods=['PUT', 'DELETE'])
def manage_appointment(id):
    conn = get_db_connection()
    if request.method == 'PUT':
        data = request.json
        conn.execute('UPDATE appointments SET client_id=?, employee_id=?, service_id=?, date=?, time=?, status=? WHERE id=?',
                    (data.get('client_id'), data.get('employee_id'), data.get('service_id'), data.get('date'), data.get('time'), data.get('status', 'Pendiente'), id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Cita actualizada"}), 200
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM appointments WHERE id=?', (id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Cita eliminada"}), 200

@app.route('/api/sales/<int:id>', methods=['PUT', 'DELETE'])
def manage_sale(id):
    conn = get_db_connection()
    if request.method == 'PUT':
        data = request.json
        conn.execute('UPDATE sales SET client_id=?, total=?, payment_method=? WHERE id=?',
                    (data.get('client_id'), data['total'], data['payment_method'], id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Venta actualizada"}), 200
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM sales WHERE id=?', (id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Venta eliminada"}), 200

@app.route('/api/promotions/<int:id>', methods=['PUT', 'DELETE'])
def manage_promotion(id):
    conn = get_db_connection()
    if request.method == 'PUT':
        data = request.json
        try:
            conn.execute('UPDATE promotions SET title=?, discount_percent=?, start_date=?, end_date=? WHERE id=?',
                        (data['title'], data['discount_percent'], data['start_date'], data['end_date'], id))
            conn.commit()
        except:
            pass
        conn.close()
        return jsonify({"message": "Promoción actualizada"}), 200
    elif request.method == 'DELETE':
        try:
            conn.execute('DELETE FROM promotions WHERE id=?', (id,))
            conn.commit()
        except:
            pass
        conn.close()
        return jsonify({"message": "Promoción eliminada"}), 200

# --- VENTAS DETALLADAS ---

@app.route('/api/sales_detailed', methods=['POST'])
def create_detailed_sale():
    """Crea una venta con detalles de items (productos/servicios)."""
    data = request.json
    conn = get_db_connection()
    
    try:
        # Insert main sale
        cur = conn.cursor()
        cur.execute('''INSERT INTO sales 
                      (client_id, total, payment_method, payment_detail, subtotal, discount_amount, 
                       promotion_title, promotion_discount, employee_id, appointment_id, created_by_id, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))''',
                   (data.get('client_id'), data['total'], data['payment_method'], 
                    data.get('payment_detail'), data.get('subtotal'),
                    data.get('discount_amount'), data.get('promotion_title'),
                    data.get('promotion_discount'), data.get('employee_id'),
                    data.get('appointment_id'), data.get('created_by_id')))
        sale_id = cur.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"id": sale_id, "message": "Venta procesada"}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400

# --- INICIO ---

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        from database import init_db
        init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
