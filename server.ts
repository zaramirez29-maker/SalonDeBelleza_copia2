import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const ROOT_DIR = process.cwd();

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const DATABASE_PATH = path.join(ROOT_DIR, 'salon.db');

  async function getDb() {
    return open({
      filename: DATABASE_PATH,
      driver: sqlite3.Database
    });
  }

  // Inicialización de la base de datos
  async function initDb() {
    const db = await getDb();
    
    await db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          role_id INTEGER NOT NULL,
          employee_id INTEGER,
          FOREIGN KEY(role_id) REFERENCES roles(id),
          FOREIGN KEY(employee_id) REFERENCES employees(id)
      );

      CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          notes TEXT,
          created_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          specialty TEXT NOT NULL,
          phone TEXT NOT NULL,
          commission_percent REAL NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          duration_minutes INTEGER NOT NULL,
          price REAL NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          brand TEXT NOT NULL,
          category TEXT NOT NULL,
          stock INTEGER NOT NULL DEFAULT 0,
          price REAL NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS appointments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER NOT NULL,
          employee_id INTEGER NOT NULL,
          service_id INTEGER NOT NULL,
          start_time DATETIME NOT NULL,
          status TEXT NOT NULL DEFAULT 'Programada',
          notes TEXT,
          created_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY(client_id) REFERENCES clients(id),
          FOREIGN KEY(employee_id) REFERENCES employees(id),
          FOREIGN KEY(service_id) REFERENCES services(id)
      );

      CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER,
          created_by_id INTEGER NOT NULL,
          payment_method TEXT NOT NULL,
          payment_detail TEXT, -- Para guardar banco, monto pagado, etc.
          employee_id INTEGER,
          appointment_id INTEGER,
          promotion_title TEXT,
          promotion_discount REAL DEFAULT 0,
          discount_amount REAL DEFAULT 0,
          subtotal REAL DEFAULT 0,
          notes TEXT,
          total REAL NOT NULL,
          created_at DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY(client_id) REFERENCES clients(id),
          FOREIGN KEY(created_by_id) REFERENCES users(id),
          FOREIGN KEY(employee_id) REFERENCES employees(id),
          FOREIGN KEY(appointment_id) REFERENCES appointments(id)
      );

      CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          item_type TEXT NOT NULL, -- 'product' or 'service'
          item_id INTEGER NOT NULL,
          appointment_id INTEGER,
          employee_id INTEGER,
          custom_name TEXT,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price REAL NOT NULL,
          subtotal REAL NOT NULL,
          FOREIGN KEY(sale_id) REFERENCES sales(id),
          FOREIGN KEY(appointment_id) REFERENCES appointments(id),
          FOREIGN KEY(employee_id) REFERENCES employees(id)
      );

      CREATE TABLE IF NOT EXISTS promotions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          discount_percent REAL,
          start_date DATE,
          end_date DATE,
          active INTEGER NOT NULL DEFAULT 1
      );
    `);

    // --- SEED PROMOTIONS ---
    const promoCount = await db.get('SELECT COUNT(*) as count FROM promotions');
    if (promoCount.count === 0) {
       const promos = [
         ['Madre Radiante', '20% de descuento en todos los servicios de color', 20.0, '2026-05-01', '2026-05-31'],
         ['Pack Amigas', 'Depilación de cejas gratis en manicure spa para dos', 10.0, '2026-05-01', '2026-06-30'],
         ['Recién Llegada', '10% OFF en tu primera visita al salón', 10.0, '2026-01-01', '2026-12-31']
       ];
       for (const p of promos) {
         await db.run('INSERT INTO promotions (title, description, discount_percent, start_date, end_date) VALUES (?, ?, ?, ?, ?)', p);
       }
    }

    // --- MIGRACIÓN: Asegurar que payment_detail existe en la tabla física ---
    try {
      await db.run("ALTER TABLE sales ADD COLUMN payment_detail TEXT;");
      console.log("Columna payment_detail añadida.");
    } catch (e) {
      // Si ya existe, fallará aquí, lo cual es normal
    }

    const saleMigrations = [
      "ALTER TABLE sales ADD COLUMN employee_id INTEGER",
      "ALTER TABLE sales ADD COLUMN appointment_id INTEGER",
      "ALTER TABLE sales ADD COLUMN promotion_title TEXT",
      "ALTER TABLE sales ADD COLUMN promotion_discount REAL DEFAULT 0",
      "ALTER TABLE sales ADD COLUMN discount_amount REAL DEFAULT 0",
      "ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0"
    ];

    const userMigrations = [
      "ALTER TABLE users ADD COLUMN employee_id INTEGER"
    ];
    for (const migration of userMigrations) {
      try {
        await db.run(migration);
      } catch (e) {
        // La columna ya existe.
      }
    }
    for (const migration of saleMigrations) {
      try {
        await db.run(migration);
      } catch (e) {
        // La columna ya existe.
      }
    }

    const saleItemMigrations = [
      "ALTER TABLE sale_items ADD COLUMN appointment_id INTEGER",
      "ALTER TABLE sale_items ADD COLUMN employee_id INTEGER",
      "ALTER TABLE sale_items ADD COLUMN custom_name TEXT"
    ];
    for (const migration of saleItemMigrations) {
      try {
        await db.run(migration);
      } catch (e) {
        // La columna ya existe.
      }
    }

    // --- SEED ROLES ---
    const roleCount = await db.get('SELECT COUNT(*) as count FROM roles');
    if (roleCount.count === 0) {
      await db.run('INSERT INTO roles (name) VALUES (?)', ['Administrador']);
      await db.run('INSERT INTO roles (name) VALUES (?)', ['Staff']);
    }

    // --- SEED EMPLOYEES (TUS DATOS REALES) ---
    const employeeCount = await db.get('SELECT COUNT(*) as count FROM employees');
    if (employeeCount.count === 0) {
       const staff = [
         ['Raquel Morales', 'Especialista en Manicure y Pedicure', '55500001', 15.0],
         ['Ivania Vanegas', 'Manicure y Pedicure', '55500002', 15.0],
         ['Marilethe Vanegas', 'Manicure y Pedicure', '55500003', 15.0],
         ['Blanca Palacios', 'Depilación con hilo, cera, microblading', '55500004', 20.0],
         ['Veronica Duarte', 'Estilista, corte dama/caballero, colorimetría', '55500005', 18.0],
         ['Evelyn Cano', 'Estilista, cortes de cabello, colorimetría, etc', '55500006', 18.0]
       ];
       for (const e of staff) {
         await db.run('INSERT INTO employees (full_name, specialty, phone, commission_percent) VALUES (?, ?, ?, ?)', e);
       }
    }

    // --- SEED USERS FOR STAFF LOGIN ---
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
      const adminRole = await db.get('SELECT id FROM roles WHERE name = "Administrador"');
      const staffRole = await db.get('SELECT id FROM roles WHERE name = "Staff"');
      
      // Admin principal
      await db.run('INSERT INTO users (full_name, email, password_hash, role_id) VALUES (?, ?, ?, ?)', 
        ['Administrador Principal', 'admin@salon.com', '123456', adminRole.id]);

      // Los del staff
      const staffUsers = [
        ['Raquel Morales', 'raquel@salon.com'],
        ['Ivania Vanegas', 'ivania@salon.com'],
        ['Marilethe Vanegas', 'marilethe@salon.com'],
        ['Blanca Palacios', 'blanca@salon.com'],
        ['Veronica Duarte', 'veronica@salon.com'],
        ['Evelyn Cano', 'evelyn@salon.com']
      ];

      for (const s of staffUsers) {
        const employee = await db.get('SELECT id FROM employees WHERE full_name = ?', [s[0]]);
        await db.run(
          'INSERT INTO users (full_name, email, password_hash, role_id, employee_id) VALUES (?, ?, ?, ?, ?)',
          [s[0], s[1], '123456', staffRole.id, employee?.id || null]
        );
      }
    }

    // --- SEED SERVICES (TUS DATOS REALES) ---
    const serviceCount = await db.get('SELECT COUNT(*) as count FROM services');
    if (serviceCount.count === 0) {
      const services = [
        ['Afeitado premium', 'Servicio empresarial con protocolo estandarizado', 105, 78.15],
        ['Balayage', 'Coloración técnica degradada', 60, 33.5],
        ['Barberia completa', 'Corte, barba y limpieza', 90, 75.8],
        ['Brushing', 'Secado y estilizado', 35, 10.0],
        ['Brushing premium', 'Protocolo estandarizado de secado especial', 90, 19.4],
        ['Color completo', 'Aplicación de tinte en todo el cabello', 45, 31.15],
        ['Color raiz', 'Retoque de crecimiento', 30, 28.8],
        ['Corte de cabello', 'Corte moderno y peinado básico', 45, 12.0],
        ['Corte ejecutivo', 'Estilo clásico masculino', 45, 12.35],
        ['Corte premium', 'Corte con tratamiento profundo', 60, 14.7],
        ['Depilacion cejas', 'Perfilado con cera o hilo', 75, 54.65],
        ['Diseno de cejas', 'Estudio morfológico y diseño', 90, 57.0],
        ['Diseno de unas', 'Arte a mano alzada', 60, 52.3],
        ['Hidratacion facial', 'Tratamiento revitalizante', 60, 71.1],
        ['Laminado de cejas', 'Efecto lifting en vello de ceja', 105, 59.35],
        ['Lavado hidratante', 'Limpieza profunda especial', 105, 21.75],
        ['Lifting de pestanas', 'Curvatura natural prolongada', 120, 61.7],
        ['Limpieza facial', 'Extracción e hidratación básica', 45, 68.75],
        ['Manicure clasico', 'Cuidado básico de uñas', 105, 40.55],
        ['Manicure gel', 'Esmaltado permanente', 135, 45.25],
        ['Manicure spa', 'Limpieza, hidratación y esmaltado', 60, 18.0],
        ['Maquillaje novia', 'Especial larga duración', 30, 66.4],
        ['Maquillaje social', 'Eventos y fiestas', 135, 64.05],
        ['Masaje relajante', 'Cuerpo completo 60min', 75, 73.45],
        ['Matizado profesional', 'Neutralización de tonos', 90, 38.2],
        ['Mechas clasicas', 'Reflectos tradicionales', 75, 35.85],
        ['Paquete corporativo', 'Servicios múltiples integrados', 120, 80.5],
        ['Pedicure clasico', 'Cuidado de pies básico', 30, 47.6],
        ['Pedicure spa', 'Relajación y cuidado intenso', 45, 49.95],
        ['Peinado express', 'Rápido y efectivo', 75, 17.05],
        ['Tinte completo', 'Color global vibrante', 120, 35.0],
        ['Tratamiento botox capilar', 'Rejuvenecimiento de fibra', 135, 26.45],
        ['Tratamiento keratina', 'Alisado y control de frizz', 120, 24.1]
      ];
      for (const s of services) {
        await db.run('INSERT INTO services (name, description, duration_minutes, price) VALUES (?, ?, ?, ?)', s);
      }
    }

    // --- SEED CLIENTS (40 CLIENTES) ---
    const clientCount = await db.get('SELECT COUNT(*) as count FROM clients');
    if (clientCount.count === 0) {
      const names = ['Mariana', 'Beatriz', 'Estela', 'Rosa', 'Clara', 'Diana', 'Elena', 'Fabiola', 'Gloria', 'Hilda', 'Irene', 'Julia', 'Karla', 'Lorena', 'Marta', 'Nadia', 'Olga', 'Paola', 'Raquel', 'Sonia', 'Teresa', 'Ursula', 'Valeria', 'Wendy', 'Ximena', 'Yara', 'Zoe', 'Ana', 'Carmen', 'Doris', 'Enriqueta', 'Felicia', 'Gisela', 'Isabel', 'Josefina', 'Laura', 'Monica', 'Patricia', 'Silvia', 'Victoria'];
      const lastNames = ['Silva', 'Luna', 'Ortiz', 'García', 'López', 'Martínez', 'Rodríguez', 'Pérez', 'Sánchez', 'Romero', 'Torres', 'Ruiz', 'Díaz', 'Morales', 'Jiménez', 'Moreno', 'Muñoz', 'Álvarez', 'Castillo', 'Vázquez'];
      for (let i = 0; i < 40; i++) {
        const full_name = `${names[i % names.length]} ${lastNames[i % lastNames.length]}`;
        const phone = `555-${1000 + i}`;
        const email = `${names[i % names.length].toLowerCase()}${i}@email.com`;
        await db.run('INSERT INTO clients (full_name, phone, email, notes) VALUES (?, ?, ?, ?)', [full_name, phone, email, 'Cliente frecuente']);
      }
    }

    // --- SEED PRODUCTS (TUS DATOS REALES) ---
    const productCount = await db.get('SELECT COUNT(*) as count FROM products');
    if (productCount.count === 0) {
       const products = [
         ['Aceite capilar', 'Beauty Team', 'Cabello', 28, 11.50],
         ['Aceite reparador', 'GlowLab', 'Cabello', 4, 14.00],
         ['Acondicionador brillo', 'GlowLab', 'Cabello', 18, 7.30],
         ['Agua micelar', 'SkinCare Co', 'Facial', 69, 31.10],
         ['Base coat', 'NailPro', 'Uñas', 51, 22.70],
         ['Brocha profesional', 'NailPro', 'Uñas', 96, 43.70],
         ['Cera moldeadora', 'Beauty Team', 'Cabello', 42, 18.50],
         ['Crema rizos', 'NailPro', 'Cabello', 36, 15.70],
         ['Delineador liquido', 'LuxeHair', 'Maquillaje', 90, 40.90],
         ['Esmalte nude', 'LuxeHair', 'Uñas', 45, 19.90],
         ['Esmalte rojo', 'NailPro', 'Uñas', 20, 3.50],
         ['Esmalte rojo elite', 'GlowLab', 'Uñas', 48, 21.30],
         ['Exfoliante corporal', 'GlowLab', 'Cuerpo', 63, 28.30],
         ['Gel styling', 'SkinCare Co', 'Cabello', 39, 17.10],
         ['Gloss brillo', 'SkinCare Co', 'Maquillaje', 84, 38.10],
         ['Labial mate', 'NailPro', 'Maquillaje', 81, 36.70],
         ['Locion hidratante', 'NailPro', 'Cuerpo', 66, 29.70],
         ['Mascara pestanas', 'GlowLab', 'Maquillaje', 93, 42.30],
         ['Mascarilla capilar', 'SilkCare', 'Cabello', 9, 12.00],
         ['Mascarilla facial', 'LuxeHair', 'Facial', 75, 33.90],
         ['Mascarilla reparadora', 'NailPro', 'Cabello', 21, 8.70],
         ['Paleta sombras', 'Beauty Team', 'Maquillaje', 87, 39.50],
         ['Pinza cejas', 'SkinCare Co', 'Belleza', 99, 45.10],
         ['Protector solar', 'GlowLab', 'Solar', 78, 35.30],
         ['Protector termico', 'LuxeHair', 'Cabello', 30, 12.90],
         ['Removedor suave', 'Beauty Team', 'Uñas', 57, 25.50],
         ['Serum argan', 'SkinCare Co', 'Cabello', 24, 10.10],
         ['Shampoo nutricion', 'LuxeHair', 'Cabello', 15, 5.90],
         ['Shampoo profesional', 'LuxeHair', 'Cabello', 15, 8.50],
         ['Spray fijador', 'GlowLab', 'Cabello', 33, 14.30],
         ['Toalla premium', 'Beauty Team', 'Accesorios', 12, 46.50],
         ['Tonico facial', 'Beauty Team', 'Facial', 72, 32.50],
         ['Top coat', 'SkinCare Co', 'Uñas', 54, 24.10]
       ];
       for (const p of products) {
         await db.run('INSERT INTO products (name, brand, category, stock, price) VALUES (?, ?, ?, ?, ?)', p);
       }
    }

    // --- SEED SALES (TUS DATOS REALES) ---
    const salesCount = await db.get('SELECT COUNT(*) as count FROM sales');
    if (salesCount.count === 0) {
      const sales = [
        [1, 1, 'Efectivo', 'Venta servicio corte', 45.0],
        [2, 1, 'Transferencia', 'Servicio color raices', 28.8],
        [3, 1, 'Efectivo', 'Manicure premium', 45.25],
        [null, 1, 'Efectivo', 'Venta Aceite capilar', 11.5]
      ];
      for (const s of sales) {
        await db.run('INSERT INTO sales (client_id, created_by_id, payment_method, notes, total) VALUES (?, ?, ?, ?, ?)', s);
      }
    }

    const saleItemCount = await db.get('SELECT COUNT(*) as count FROM sale_items');
    if (saleItemCount.count === 0) {
      const saleItems = [
        [1, 'service', 8, null, 5, null, 1, 45.0, 45.0],
        [2, 'service', 13, null, 2, null, 1, 28.8, 28.8],
        [3, 'service', 22, null, 3, null, 1, 45.25, 45.25],
        [4, 'product', 1, null, null, null, 1, 11.5, 11.5]
      ];
      for (const item of saleItems) {
        await db.run(
          'INSERT INTO sale_items (sale_id, item_type, item_id, appointment_id, employee_id, custom_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          item
        );
      }
    }

    await db.close();
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Salon Pro Backend - Global Ready' });
  });

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await getDb();
    const user = await db.get(
      'SELECT u.id, u.full_name, u.email, u.employee_id, r.name as role '
      + 'FROM users u '
      + 'JOIN roles r ON u.role_id = r.id '
      + 'WHERE u.email = ? AND u.password_hash = ? AND u.active = 1',
      [username, password]
    );
    await db.close();
    if (user) {
      res.json({ status: 'success', user: { id: user.id, username: user.full_name, role: user.role, employee_id: user.employee_id } });
    } else {
      res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos' });
    }
  });

  // --- GENERIC CRUD HELPERS (Refactored for efficiency) ---
  const entities = [
    { table: 'clients', route: 'clients', fields: ['full_name', 'phone', 'email', 'notes'], id_field: 'id' },
    { table: 'employees', route: 'employees', fields: ['full_name', 'specialty', 'phone', 'commission_percent'], id_field: 'id' },
    { table: 'services', route: 'services', fields: ['name', 'description', 'duration_minutes', 'price'], id_field: 'id' },
    { table: 'products', route: 'products', fields: ['name', 'brand', 'category', 'price', 'stock'], id_field: 'id' },
    { table: 'appointments', route: 'appointments', fields: ['client_id', 'employee_id', 'service_id', 'start_time', 'status', 'notes'], id_field: 'id' },
    { table: 'promotions', route: 'promotions', fields: ['title', 'description', 'discount_percent', 'start_date', 'end_date', 'active'], id_field: 'id' }
  ];

  entities.forEach(entity => {
    // GET ALL
    app.get(`/api/${entity.route}`, async (req, res) => {
      const db = await getDb();
      let query = `SELECT * FROM ${entity.table}`;
      if (entity.table === 'clients') query += ' ORDER BY full_name ASC';
      if (entity.table === 'appointments') {
        query = `
          SELECT a.*, c.full_name as client_name, e.full_name as employee_name, s.name as service_name, s.price as price,
          strftime('%Y-%m-%d', a.start_time) as date, strftime('%H:%M', a.start_time) as time
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN employees e ON a.employee_id = e.id
          LEFT JOIN services s ON a.service_id = s.id
          ORDER BY a.start_time DESC
        `;
      }
      if (entity.table === 'sales') {
        query = `
          SELECT s.*, c.full_name as client_name, c.phone as client_phone, e.full_name as employee_name
          FROM sales s 
          LEFT JOIN clients c ON s.client_id = c.id 
          LEFT JOIN employees e ON s.employee_id = e.id
          ORDER BY s.created_at DESC
        `;
      }
      const data = await db.all(query);
      await db.close();
      const mappedData = data.map(item => ({
        ...item,
        name: item.full_name || item.name,
        commission: item.commission_percent
      }));
      res.json(mappedData);
    });

    // POST
    app.post(`/api/${entity.route}`, async (req, res) => {
      let db;
      try {
        db = await getDb();

        // VALIDACIÓN PARA CITAS (Evitar choques de horario)
        if (entity.table === 'appointments') {
          const { employee_id, start_time } = req.body;
          const exists = await db.get(
            'SELECT id FROM appointments WHERE employee_id = ? AND start_time = ? AND status != "Cancelada"',
            [employee_id, start_time]
          );
          if (exists) {
            return res.status(400).json({ message: 'La trabajadora ya tiene una cita a esa hora.' });
          }
        }

        if (entity.table === 'clients' || entity.table === 'employees') {
          const phone = String(req.body.phone || '');
          if (!/^\d{8}$/.test(phone)) {
            return res.status(400).json({ message: 'El teléfono debe tener exactamente 8 dígitos.' });
          }
        }

        const providedFields = entity.fields.filter(f => req.body[f === 'full_name' ? 'name' : (f === 'active' ? 'active' : f)] !== undefined);
        
        // Si no se pasaron campos (raro), intentamos con todos por si acaso o fallará igual
        const fieldsToUse = providedFields.length > 0 ? providedFields : entity.fields;

        const keys = fieldsToUse.join(', ');
        const placeholders = fieldsToUse.map(() => '?').join(', ');
        const values = fieldsToUse.map(f => {
          let val = req.body[f === 'full_name' ? 'name' : f];
          return val === undefined ? null : val;
        }); 
        
        await db.run(`INSERT INTO ${entity.table} (${keys}) VALUES (${placeholders})`, values);
        res.status(201).json({ message: 'Success' });
      } catch (err: any) {
        console.error(`Error in POST /api/${entity.route}:`, err);
        res.status(500).json({ message: 'Error interno del servidor', error: err.message });
      } finally {
        if (db) await db.close();
      }
    });

    // PUT (Update)
    app.put(`/api/${entity.route}/:id`, async (req, res) => {
      let db;
      try {
        db = await getDb();
        if (entity.table === 'clients' || entity.table === 'employees') {
          const phone = String(req.body.phone || '');
          if (!/^\d{8}$/.test(phone)) {
            return res.status(400).json({ message: 'El teléfono debe tener exactamente 8 dígitos.' });
          }
        }
        const updates = entity.fields.map(f => `${f} = ?`).join(', ');
        const values = entity.fields.map(f => {
          let val = req.body[f === 'full_name' ? 'name' : f];
          if (val === undefined) val = null;
          return val;
        });
        values.push(req.params.id);
        await db.run(`UPDATE ${entity.table} SET ${updates} WHERE ${entity.id_field} = ?`, values);
        res.json({ message: 'Updated successfully' });
      } catch (err: any) {
        console.error(`Error in PUT /api/${entity.route}:`, err);
        res.status(500).json({ message: 'Error al actualizar', error: err.message });
      } finally {
        if (db) await db.close();
      }
    });

    // DELETE
    app.delete(`/api/${entity.route}/:id`, async (req, res) => {
      const db = await getDb();
      await db.run(`DELETE FROM ${entity.table} WHERE ${entity.id_field} = ?`, [req.params.id]);
      await db.close();
      res.json({ message: 'Deleted successfully' });
    });
  });

  app.get('/api/stats', async (req, res) => {
    const db = await getDb();
    const clients = await db.get('SELECT COUNT(*) as count FROM clients');
    const employees = await db.get('SELECT COUNT(*) as count FROM employees WHERE active = 1');
    const services = await db.get('SELECT COUNT(*) as count FROM services WHERE active = 1');
    const income = await db.get("SELECT SUM(total) as total FROM sales WHERE date(created_at) = date('now', 'localtime')");
    const lowStock = await db.get('SELECT COUNT(*) as count FROM products WHERE stock <= 5');
    await db.close();
    res.json({
      clients_count: clients?.count || 0,
      employees_count: employees?.count || 0,
      services_count: services?.count || 0,
      today_income: income?.total || 0,
      low_stock: lowStock?.count || 0
    });
  });

  app.get('/api/sales', async (req, res) => {
    const db = await getDb();
    const query = `
      SELECT s.*, c.full_name as client_name, c.phone as client_phone, e.full_name as employee_name
      FROM sales s 
      LEFT JOIN clients c ON s.client_id = c.id 
      LEFT JOIN employees e ON s.employee_id = e.id
      ORDER BY s.created_at DESC
    `;
    const sales = await db.all(query);
    
    // Adjuntar items para cada venta
    for (const sale of sales) {
      const items = await db.all(`
        SELECT si.*, e.full_name as employee_name,
               CASE 
                 WHEN si.custom_name IS NOT NULL THEN si.custom_name
                 WHEN si.item_type = 'product' THEN p.name 
                 WHEN si.item_type = 'service' THEN s.name 
                 ELSE si.item_type
               END as item_name
        FROM sale_items si
        LEFT JOIN products p ON si.item_type = 'product' AND si.item_id = p.id
        LEFT JOIN services s ON si.item_type = 'service' AND si.item_id = s.id
        LEFT JOIN employees e ON si.employee_id = e.id
        WHERE si.sale_id = ?
      `, [sale.id]);
      sale.items = items.map((item: any) => ({
        ...item,
        item_name: item.item_name || `${item.item_type || 'Item'} #${item.item_id}`
      }));
    }

    await db.close();
    res.json(sales);
  });

  app.delete('/api/sales/:id', async (req, res) => {
    const db = await getDb();
    try {
      await db.run('BEGIN TRANSACTION');
      await db.run('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id]);
      await db.run('DELETE FROM sales WHERE id = ?', [req.params.id]);
      await db.run('COMMIT');
      res.json({ message: 'Venta eliminada' });
    } catch (err: any) {
      await db.run('ROLLBACK');
      res.status(500).json({ message: 'Error al eliminar venta', error: err.message });
    } finally {
      await db.close();
    }
  });

  // Especial para crear ventas con items
  app.post('/api/sales_detailed', async (req, res) => {
    const { client_id, created_by_id, payment_method, payment_detail, notes, total, items, employee_id, appointment_id, promotion_title, promotion_discount, discount_amount, subtotal } = req.body;
    let db;
    try {
      db = await getDb();
      await db.run('BEGIN TRANSACTION');
      const appointmentItem = (items || []).find((item: any) => item.appointment_id);
      const finalAppointmentId = appointment_id || appointmentItem?.appointment_id || null;
      const finalEmployeeId = employee_id || appointmentItem?.employee_id || null;
      
      const saleResult = await db.run(
        'INSERT INTO sales (client_id, created_by_id, payment_method, payment_detail, employee_id, appointment_id, promotion_title, promotion_discount, discount_amount, subtotal, notes, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [client_id, created_by_id, payment_method, payment_detail, finalEmployeeId, finalAppointmentId, promotion_title || null, promotion_discount || 0, discount_amount || 0, subtotal || total, notes, total]
      );
      
      const saleId = saleResult.lastID;
      
      for (const item of items) {
        if (item.type === 'product') {
          const product = await db.get('SELECT stock, name FROM products WHERE id = ?', [item.id]);
          if (!product || product.stock < item.quantity) {
             throw new Error(`Stock insuficiente para ${product?.name || 'producto'}`);
          }
        }

        await db.run(
          'INSERT INTO sale_items (sale_id, item_type, item_id, appointment_id, employee_id, custom_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [saleId, item.type, item.id, item.appointment_id || null, item.employee_id || null, item.name || null, item.quantity, item.price, item.quantity * item.price]
        );

        // Actualizar stock si es producto
        if (item.type === 'product') {
          await db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
        }
        if (item.appointment_id) {
          await db.run('UPDATE appointments SET status = "Completada" WHERE id = ?', [item.appointment_id]);
        }
      }
      
      await db.run('COMMIT');
      res.status(201).json({ message: 'Venta creada con éxito', saleId });
    } catch (err: any) {
      if (db) await db.run('ROLLBACK');
      console.error('Error al crear venta detallada:', err);
      res.status(500).json({ message: 'Error al procesar la venta', error: err.message });
    } finally {
      if (db) await db.close();
    }
  });

  // Ruta para cerrar cita y crear venta
  app.post('/api/appointments/:id/checkout', async (req, res) => {
    const appointmentId = req.params.id;
    const { payment_method, payment_detail, notes, items, total, created_by_id, promotion_title, promotion_discount, discount_amount, subtotal } = req.body;
    let db;
    try {
      db = await getDb();
      await db.run('BEGIN TRANSACTION');
      
      // Obtener info de la cita
      const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
      if (!appointment) throw new Error('Cita no encontrada');

      const appointmentTime = new Date(appointment.start_time || `${appointment.date}T${appointment.time}`);
      if (appointmentTime > new Date()) {
        throw new Error('El pago de la cita sólo se permite después de la fecha y hora programada.');
      }
      if (appointment.status !== 'Programada') {
        throw new Error('La cita ya no está en estado programada.');
      }

      // Crear la venta
      const saleResult = await db.run(
        'INSERT INTO sales (client_id, created_by_id, payment_method, payment_detail, employee_id, appointment_id, promotion_title, promotion_discount, discount_amount, subtotal, notes, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [appointment.client_id, created_by_id, payment_method, payment_detail, appointment.employee_id, appointment.id, promotion_title || null, promotion_discount || 0, discount_amount || 0, subtotal || total, notes, total]
      );
      const saleId = saleResult.lastID;

      // Insertar items
      for (const item of items) {
        if (item.type === 'product') {
           const product = await db.get('SELECT stock, name FROM products WHERE id = ?', [item.id]);
           if (!product || product.stock < (item.quantity || 1)) {
              throw new Error(`Stock insuficiente para ${product?.name || 'producto'}`);
           }
        }

        await db.run(
          'INSERT INTO sale_items (sale_id, item_type, item_id, appointment_id, employee_id, custom_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [saleId, item.type || 'service', item.id, item.appointment_id || null, item.employee_id || null, item.name || null, item.quantity || 1, item.price, (item.quantity || 1) * item.price]
        );
        if (item.type === 'product') {
          await db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
        }
      }

      // Actualizar estado de la cita
      await db.run('UPDATE appointments SET status = "Completada" WHERE id = ?', [appointmentId]);
      for (const item of items) {
        if (item.appointment_id) {
          await db.run('UPDATE appointments SET status = "Completada" WHERE id = ?', [item.appointment_id]);
        }
      }

      await db.run('COMMIT');
      res.json({ message: 'Checkout realizado con éxito', saleId });
    } catch (err: any) {
      if (db) await db.run('ROLLBACK');
      res.status(500).json({ message: 'Error en checkout', error: err.message });
    } finally {
      if (db) await db.close();
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
  });
}

startServer();
