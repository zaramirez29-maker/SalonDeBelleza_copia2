import sqlite3

# --- SISTEMA DE GESTIÓN "BEAUTY TEAM SALON" ---
# Este script inicializa la base de datos SQLite con tablas robustas y datos de prueba.

def init_db():
    conn = sqlite3.connect('salon.db')
    cursor = conn.cursor()

    # 1. TABLA DE USUARIOS (Login)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin'
    )
    ''')

    # 2. TABLA DE CLIENTES
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        notes TEXT
    )
    ''')

    # 3. TABLA DE EMPLEADAS (Exactamente 5)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialty TEXT,
        phone TEXT,
        commission REAL DEFAULT 10.0
    )
    ''')

    # 4. TABLA DE SERVICIOS
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT
    )
    ''')

    # 5. TABLA DE PRODUCTOS
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand TEXT,
        category TEXT,
        price REAL NOT NULL,
        stock INTEGER NOT NULL
    )
    ''')

    # 6. TABLA DE CITAS
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        employee_id INTEGER,
        service_id INTEGER,
        date TEXT,
        time TEXT,
        status TEXT DEFAULT 'Pendiente',
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (service_id) REFERENCES services(id)
    )
    ''')

    # 7. TABLA DE VENTAS
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT DEFAULT (datetime('now', 'localtime')),
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        client_id INTEGER,
        total REAL NOT NULL,
        payment_method TEXT,
        payment_detail TEXT,
        subtotal REAL,
        discount_amount REAL DEFAULT 0,
        promotion_title TEXT,
        promotion_discount REAL DEFAULT 0,
        employee_id INTEGER,
        appointment_id INTEGER,
        created_by_id INTEGER,
        processed_by TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id)
    )
    ''')

    # 8. TABLA DE PROMOCIONES
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        discount_percent REAL NOT NULL,
        start_date TEXT,
        end_date TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    ''')

    # --- DATOS DE PRUEBA (SEEDING) ---
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
                      ('admin@salon.com', '123456', 'Administrador Principal'))

    staff_users = [
        ('raquel@salon.com', '123456', 'Staff'),
        ('ivania@salon.com', '123456', 'Staff'),
        ('marileth@salon.com', '123456', 'Staff'),
        ('blanca@salon.com', '123456', 'Staff'),
        ('veronica@salon.com', '123456', 'Staff'),
        ('evelyn@salon.com', '123456', 'Staff')
    ]
    for u in staff_users:
        cursor.execute("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)", u)

    cursor.execute("SELECT COUNT(*) FROM clients")
    if cursor.fetchone()[0] == 0:
        clients = [
            ('Carla Gómez', '88110011', 'carla@mail.com', 'Cuero cabelludo sensible'),
            ('Adriana Mejia', '88220022', 'adriana@mail.com', 'Prefiere tinte sin amoniaco'),
            ('Fernanda Molina', '88330033', 'fer@mail.com', 'Puntual'),
            ('Alicia Moreno', '88440044', 'alicia@mail.com', 'Frecuente'),
            ('Diana Salazar', '88550055', 'diana@mail.com', 'Le gusta el café frío'),
            ('Roberto Ruiz', '88660066', 'roberto@mail.com', 'Corte clásico'),
            ('Lucía Méndez', '88770077', 'lucia@mail.com', 'Manicura frecuente'),
            ('Marcos Torres', '88880088', 'marcos@mail.com', 'Tratamiento facial mensual'),
            ('Camila Ríos', '88990099', 'camila@mail.com', 'Prefiere colores naturales'),
            ('Paola Vega', '88112244', 'paola@mail.com', 'Cortes cortos modernos'),
            ('Melissa Paredes', '88223355', 'melissa@mail.com', 'Luce uñas de gel'),
            ('Juliana Castillo', '88334466', 'juliana@mail.com', 'Espera resultados rápidos'),
            ('Daniela Herrera', '88445577', 'daniela@mail.com', 'Tiene piel sensible'),
            ('Vanessa Cruz', '88556688', 'vanessa@mail.com', 'Le encanta el maquillaje'),
            ('Natalia Suárez', '88667799', 'natalia@mail.com', 'Busca tratamientos capilares'),
            ('Michelle Ramírez', '88778811', 'michelle@mail.com', 'Alergia a algunos tintes'),
            ('Karla Jiménez', '88889922', 'karla@mail.com', 'Síndrome de uñas frágiles'),
            ('Sara Aguirre', '88990011', 'sara@mail.com', 'Reserva con antelación'),
            ('Sonia Alvarado', '88113355', 'sonia@mail.com', 'Prefiere servicio express'),
            ('Elisa Navarro', '88224466', 'elisa@mail.com', 'Le gustan tratamientos naturales'),
            ('Claudia Domínguez', '88335577', 'claudia@mail.com', 'Busca diseños de cejas'),
            ('Graciela Ortiz', '88446688', 'graciela@mail.com', 'Problemas de caspa'),
            ('Raquel Santos', '88557799', 'raquel@mail.com', 'A menudo compra productos'),
            ('Mónica Fuentes', '88668811', 'monica@mail.com', 'Prefiere servicios premium'),
            ('Sandra Valdez', '88779922', 'sandra@mail.com', 'Usa a menudo tintes'),
            ('Karen Blanco', '88881133', 'karen@mail.com', 'Tiene citas semanales'),
            ('Brenda Serrano', '88992244', 'brenda@mail.com', 'Le gusta la manicura francesa'),
            ('Erika Salinas', '88113366', 'erika@mail.com', 'Busca volumen en su cabello'),
            ('Patricia León', '88224477', 'patricia@mail.com', 'Tratamiento de cutis'),
            ('Andrea Castaño', '88335588', 'andrea@mail.com', 'Desea balayage suave'),
            ('Ivonne Alcántara', '88446699', 'ivonne@mail.com', 'Citas frecuentes para uñas'),
            ('Noelia Mejía', '88557711', 'noelia@mail.com', 'Le gusta cambiar de look'),
            ('Romina Flores', '88668822', 'romina@mail.com', 'Prefiere paquetes de color'),
            ('Vivian Castro', '88779933', 'vivian@mail.com', 'Busca tratamientos anti-frizz'),
            ('Teresa Durán', '88881144', 'teresa@mail.com', 'Requiere servicios corporales')
        ]
        cursor.executemany("INSERT INTO clients (name, phone, email, notes) VALUES (?, ?, ?, ?)", clients)

    cursor.execute("SELECT COUNT(*) FROM employees")
    if cursor.fetchone()[0] == 0:
        employees = [
            ('Evelyn Cano', 'Estilista: Corte, Peinado y Tinte Profesional', '88112233', 18.0),
            ('Verónica Castro', 'Colorimetría, Balayage y Mechas', '88223344', 17.0),
            ('Marileth Vanegas', 'Manicura y Pedicura Especializada', '88334455', 20.0),
            ('Ivania Vanegas', 'Manicura, Pedicura y Nail Art', '88445566', 20.0),
            ('Raquel Morales', 'Manicura, Pedicura y Spa de Uñas', '88556677', 20.0),
            ('Blanca Palacio', 'Depilación, Diseño de Cejas y Facial', '88667788', 19.0)
        ]
        cursor.executemany("INSERT INTO employees (name, specialty, phone, commission) VALUES (?, ?, ?, ?)", employees)

    cursor.execute("SELECT COUNT(*) FROM services")
    if cursor.fetchone()[0] == 0:
        services = [
            ('Corte de cabello', 25.00, 'Corte'),
            ('Corte premium', 45.00, 'Corte'),
            ('Corte masculino', 22.00, 'Corte'),
            ('Corte de cabello con tratamiento nutritivo', 35.00, 'Corte'),
            ('Lavado hidratante', 15.00, 'Tratamiento'),
            ('Masaje capilar revitalizante', 35.00, 'Tratamiento'),
            ('Tratamiento de reconstrucción capilar', 55.00, 'Tratamiento'),
            ('Tratamiento anti-frizz', 45.00, 'Tratamiento'),
            ('Nanoplastia capilar', 120.00, 'Alisado'),
            ('Nanoplastia express', 95.00, 'Alisado'),
            ('Alisado con keratina', 140.00, 'Alisado'),
            ('Tinte completo', 60.00, 'Color'),
            ('Tinte de raíces', 45.00, 'Color'),
            ('Mechas californianas', 85.00, 'Color'),
            ('Balayage', 95.00, 'Color'),
            ('Reflejos sutiles', 70.00, 'Color'),
            ('Retoque de raíces', 55.00, 'Color'),
            ('Depilación con cera piernas completas', 40.00, 'Depilación'),
            ('Depilación con cera bikini', 28.00, 'Depilación'),
            ('Depilación facial', 18.00, 'Depilación'),
            ('Diseño de cejas', 20.00, 'Depilación'),
            ('Tintura de cejas', 15.00, 'Depilación'),
            ('Microblading de cejas', 120.00, 'Depilación'),
            ('Manicura gel', 30.00, 'Uñas'),
            ('Pedicura spa', 40.00, 'Uñas'),
            ('Uñas acrílicas', 50.00, 'Uñas'),
            ('Manicura francesa', 35.00, 'Uñas'),
            ('Extensión de pestañas', 60.00, 'Pestañas'),
            ('Limpieza facial profunda', 65.00, 'Facial'),
            ('Facial antiacné', 80.00, 'Facial'),
            ('Peeling químico facial', 75.00, 'Facial'),
            ('Maquillaje profesional', 55.00, 'Maquillaje'),
            ('Peinado de fiesta', 50.00, 'Peinado'),
            ('Peinado novia', 120.00, 'Peinado'),
            ('Spa corporal relajante', 70.00, 'Spa'),
            ('Reparación de puntas', 40.00, 'Tratamiento')
        ]
        cursor.executemany("INSERT INTO services (name, price, category) VALUES (?, ?, ?)", services)

    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        products = [
            ('Aceite capilar', 'Loreal', 'Cabello', 11.50, 27),
            ('Shampoo Brillo', 'Pantene', 'Cabello', 15.00, 15),
            ('Acondicionador Pro', 'TRESemmé', 'Cabello', 18.50, 12),
            ('Protector térmico', 'TRESemmé', 'Cabello', 14.00, 20),
            ('Serum crecimiento', 'Kérastase', 'Cabello', 32.00, 10),
            ('Shampoo anticaspa', 'Head & Shoulders', 'Cabello', 12.00, 18),
            ('Crema de peinar', 'Dove', 'Cabello', 9.50, 22),
            ('Mascarilla de noche', 'L\'Occitane', 'Cabello', 28.00, 8),
            ('Tinte en crema', 'Wella', 'Color', 20.00, 14),
            ('Laca fijación extra', 'Taft', 'Cabello', 12.50, 11),
            ('Gel fijador', 'EcoStyler', 'Cabello', 10.00, 13),
            ('Cepillo térmico', 'Remington', 'Herramienta', 25.00, 7),
            ('Planchita', 'GHD', 'Herramienta', 120.00, 4),
            ('Depiladora eléctrica', 'Philips', 'Depilación', 55.00, 6),
            ('Cera tibia', 'Italwax', 'Depilación', 18.00, 20),
            ('Bandas depilatorias', 'Veet', 'Depilación', 10.00, 25),
            ('Removedor de cera', 'Sally Hansen', 'Depilación', 12.00, 18),
            ('Lima de uñas cristal', 'Scholl', 'Uñas', 7.00, 10),
            ('Top coat', 'Sally Hansen', 'Uñas', 9.00, 16),
            ('Removedor de esmalte', 'Cutex', 'Uñas', 6.00, 28),
            ('Aceite de cutícula', 'Sally Hansen', 'Uñas', 8.50, 21),
            ('Esmalte Rojo', 'OPI', 'Uñas', 8.00, 50),
            ('Esmalte nude', 'Essie', 'Uñas', 9.50, 30),
            ('Esmalte oscuro', 'Revlon', 'Uñas', 8.50, 24),
            ('Esmalte brillante', 'OPI', 'Uñas', 9.00, 26),
            ('Mascarilla Arcilla', 'Neutrogena', 'Facial', 22.00, 8),
            ('Serum Vitamina C', 'La Roche', 'Facial', 35.00, 4),
            ('Tónico facial', 'Bioderma', 'Facial', 20.00, 12),
            ('Agua micelar', 'Garnier', 'Facial', 13.00, 20),
            ('Crema humectante', 'Nivea', 'Facial', 14.00, 20),
            ('Esponja de limpieza', 'Silicone', 'Facial', 7.50, 18),
            ('Mascarilla de colágeno', 'Silcare', 'Facial', 18.00, 10),
            ('Polvo compacto', 'Maybelline', 'Maquillaje', 12.00, 18),
            ('Base líquida', 'L\'Oréal', 'Maquillaje', 16.00, 15),
            ('Rubor iluminador', 'NYX', 'Maquillaje', 11.00, 14),
            ('Corrector', 'Maybelline', 'Maquillaje', 10.00, 17),
            ('Labial mate', 'MAC', 'Maquillaje', 19.00, 12),
            ('Brillo labial', 'Fenty', 'Maquillaje', 18.00, 11),
            ('Brocha de maquillaje', 'Real Techniques', 'Maquillaje', 14.00, 12),
            ('Polvo matificante', 'Rimmel', 'Maquillaje', 10.00, 20),
            ('Aceite capilar reparación', 'L\'Oréal', 'Cabello', 13.00, 16),
            ('Sérum anti-frizz', 'Garnier', 'Cabello', 14.50, 14),
            ('Cera depilatoria', 'Veet', 'Depilación', 11.00, 22)
        ]
        cursor.executemany("INSERT INTO products (name, brand, category, price, stock) VALUES (?, ?, ?, ?, ?)", products)

    # Agregar algunas citas y ventas para que no esté vacío
    cursor.execute("SELECT COUNT(*) FROM appointments")
    if cursor.fetchone()[0] == 0:
        import datetime
        today = datetime.date.today().strftime('%Y-%m-%d')
        appointments = [
            (1, 1, 1, today, '10:00', 'Pendiente'),
            (2, 2, 2, today, '11:00', 'Asistida'),
            (3, 3, 5, today, '12:30', 'Pendiente')
        ]
        cursor.executemany("INSERT INTO appointments (client_id, employee_id, service_id, date, time, status) VALUES (?, ?, ?, ?, ?, ?)", appointments)

    cursor.execute("SELECT COUNT(*) FROM sales")
    if cursor.fetchone()[0] == 0:
        import datetime
        today = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        sales = [
            (1, 85.00, 'Efectivo', 'admin@salon.com', today),
            (2, 45.00, 'Transferencia', 'admin@salon.com', today),
            (None, 11.50, 'Efectivo', 'admin@salon.com', today)
        ]
        try:
            cursor.execute("ALTER TABLE sales ADD COLUMN date TEXT")
        except:
            pass
        cursor.executemany("INSERT INTO sales (client_id, total, payment_method, processed_by, date) VALUES (?, ?, ?, ?, ?)", sales)

    # Agregar datos de prueba de promociones
    cursor.execute("SELECT COUNT(*) FROM promotions")
    if cursor.fetchone()[0] == 0:
        import datetime
        today = datetime.date.today().strftime('%Y-%m-%d')
        tomorrow = (datetime.date.today() + datetime.timedelta(days=30)).strftime('%Y-%m-%d')
        promotions = [
            ('Descuento Viernes 50%', 50, today, tomorrow),
            ('Combo 3 servicios 20%', 20, today, tomorrow),
            ('Cliente frecuente 15%', 15, today, tomorrow)
        ]
        cursor.executemany("INSERT INTO promotions (title, discount_percent, start_date, end_date) VALUES (?, ?, ?, ?)", promotions)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Base de datos pulida con éxito.")

if __name__ == "__main__":
    init_db()
    print("Base de datos de 'Beauty Team Salon' inicializada.")
