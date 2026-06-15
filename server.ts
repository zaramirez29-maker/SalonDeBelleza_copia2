import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { readFileSync } from 'fs';

// Leer .env manualmente sin depender de dotenv
try {
  const envFile = readFileSync(path.join(process.cwd(), '.env'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  // Si no existe .env, usa los valores por defecto del pool
}

const ROOT_DIR = process.cwd();

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// -------------------------------------------------------
// POOL DE CONEXIONES MYSQL
// -------------------------------------------------------
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'salondb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Mejor manejo y prueba de conexión inicial
async function testPoolConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping?.();
    conn.release();
    console.log('✅ Conexión MySQL OK');
    return true;
  } catch (err: any) {
    console.error('❌ Error conectando a MySQL:', err.message || err);
    return false;
  }
}

async function getDb() {
  const conn = await pool.getConnection();
  return {
    async get(query: string, params: any[] = []) {
      const [rows]: any = await conn.execute(query, params);
      return rows[0] ?? null;
    },
    async all(query: string, params: any[] = []) {
      const [rows]: any = await conn.execute(query, params);
      return rows;
    },
    async run(query: string, params: any[] = []) {
      const [result]: any = await conn.execute(query, params);
      return { lastID: result.insertId, changes: result.affectedRows };
    },
    async beginTransaction() { await conn.beginTransaction(); },
    async commit()           { await conn.commit(); },
    async rollback()         { await conn.rollback(); },
    async close()            { conn.release(); }
  };
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // -------------------------------------------------------
  // INICIALIZACIÓN DE LA BASE DE DATOS
  // -------------------------------------------------------
  async function initDb() {
    const conn = await pool.getConnection();
    try {
      // 1. ROLES
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS roles (
          id   INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 2. EMPLEADOS (antes que users por la FK)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS employees (
          id                INT AUTO_INCREMENT PRIMARY KEY,
          full_name         VARCHAR(255) NOT NULL,
          specialty         TEXT NOT NULL,
          phone             VARCHAR(50)  NOT NULL,
          commission_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
          active            TINYINT(1)   NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 3. USUARIOS
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id            INT AUTO_INCREMENT PRIMARY KEY,
          full_name     VARCHAR(255) NOT NULL,
          email         VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          active        TINYINT(1)   NOT NULL DEFAULT 1,
          role_id       INT          NOT NULL,
          employee_id   INT,
          FOREIGN KEY (role_id)     REFERENCES roles(id),
          FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 4. CLIENTES
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS clients (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          full_name  VARCHAR(255) NOT NULL,
          phone      VARCHAR(50)  NOT NULL,
          email      VARCHAR(255),
          notes      TEXT,
          created_at DATETIME     NOT NULL DEFAULT NOW()
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 5. SERVICIOS
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS services (
          id               INT AUTO_INCREMENT PRIMARY KEY,
          name             VARCHAR(255) NOT NULL,
          description      TEXT,
          duration_minutes INT          NOT NULL,
          price            DECIMAL(10,2) NOT NULL,
          active           TINYINT(1)   NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 6. PRODUCTOS
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id       INT AUTO_INCREMENT PRIMARY KEY,
          name     VARCHAR(255)  NOT NULL,
          brand    VARCHAR(100)  NOT NULL,
          category VARCHAR(100)  NOT NULL,
          stock    INT           NOT NULL DEFAULT 0,
          price    DECIMAL(10,2) NOT NULL,
          active   TINYINT(1)    NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 7. CITAS
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS appointments (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          client_id   INT         NOT NULL,
          employee_id INT         NOT NULL,
          service_id  INT         NOT NULL,
          start_time  DATETIME    NOT NULL,
          status      VARCHAR(50) NOT NULL DEFAULT 'Programada',
          notes       TEXT,
          created_at  DATETIME    NOT NULL DEFAULT NOW(),
          FOREIGN KEY (client_id)   REFERENCES clients(id),
          FOREIGN KEY (employee_id) REFERENCES employees(id),
          FOREIGN KEY (service_id)  REFERENCES services(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 8. VENTAS
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS sales (
          id                 INT AUTO_INCREMENT PRIMARY KEY,
          client_id          INT,
          created_by_id      INT           NOT NULL,
          payment_method     VARCHAR(100)  NOT NULL,
          payment_detail     TEXT,
          employee_id        INT,
          appointment_id     INT,
          promotion_title    VARCHAR(255),
          promotion_discount DECIMAL(10,2) DEFAULT 0,
          discount_amount    DECIMAL(10,2) DEFAULT 0,
          subtotal           DECIMAL(10,2) DEFAULT 0,
          notes              TEXT,
          total              DECIMAL(10,2) NOT NULL,
          created_at         DATETIME      NOT NULL DEFAULT NOW(),
          FOREIGN KEY (client_id)      REFERENCES clients(id)      ON DELETE SET NULL,
          FOREIGN KEY (created_by_id)  REFERENCES users(id),
          FOREIGN KEY (employee_id)    REFERENCES employees(id)    ON DELETE SET NULL,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 9. ITEMS DE VENTA
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id             INT AUTO_INCREMENT PRIMARY KEY,
          sale_id        INT          NOT NULL,
          item_type      VARCHAR(50)  NOT NULL,
          item_id        INT          NOT NULL,
          appointment_id INT,
          employee_id    INT,
          custom_name    VARCHAR(255),
          quantity       INT          NOT NULL DEFAULT 1,
          unit_price     DECIMAL(10,2) NOT NULL,
          subtotal       DECIMAL(10,2) NOT NULL,
          FOREIGN KEY (sale_id)        REFERENCES sales(id)        ON DELETE CASCADE,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
          FOREIGN KEY (employee_id)    REFERENCES employees(id)    ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 10. PROMOCIONES
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS promotions (
          id               INT AUTO_INCREMENT PRIMARY KEY,
          title            VARCHAR(255)  NOT NULL,
          description      TEXT,
          discount_percent DECIMAL(5,2),
          start_date       DATE,
          end_date         DATE,
          active           TINYINT(1)   NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // -------------------------------------------------------
      // SEED ROLES
      // -------------------------------------------------------
      const [roleRows]: any = await conn.execute('SELECT COUNT(*) as cnt FROM roles');
      if (roleRows[0].cnt === 0) {
        await conn.execute("INSERT INTO roles (name) VALUES ('Administrador'), ('Staff')");
      }

      // -------------------------------------------------------
      // SEED EMPLEADOS
      // -------------------------------------------------------
      const [empRows]: any = await conn.execute('SELECT COUNT(*) as cnt FROM employees');
      if (empRows[0].cnt === 0) {
        const staff = [
          ['Raquel Morales',    'Especialista en Manicure y Pedicure',              '55500001', 15.0],
          ['Ivania Vanegas',    'Manicure y Pedicure',                              '55500002', 15.0],
          ['Marilethe Vanegas', 'Manicure y Pedicure',                              '55500003', 15.0],
          ['Blanca Palacios',   'Depilación con hilo, cera, microblading',          '55500004', 20.0],
          ['Veronica Duarte',   'Estilista, corte dama/caballero, colorimetría',    '55500005', 18.0],
          ['Evelyn Cano',       'Estilista, cortes de cabello, colorimetría, etc',  '55500006', 18.0],
        ];
        for (const e of staff) {
          await conn.execute(
            'INSERT INTO employees (full_name, specialty, phone, commission_percent) VALUES (?, ?, ?, ?)', e
          );
        }
      }

      // -------------------------------------------------------
      // SEED USUARIOS
      // -------------------------------------------------------
      const [userRows]: any = await conn.execute('SELECT COUNT(*) as cnt FROM users');
      if (userRows[0].cnt === 0) {
        const [adminRoleRows]: any = await conn.execute("SELECT id FROM roles WHERE name = 'Administrador'");
        const [staffRoleRows]: any = await conn.execute("SELECT id FROM roles WHERE name = 'Staff'");
        const adminRoleId = adminRoleRows[0].id;
        const staffRoleId = staffRoleRows[0].id;

        await conn.execute(
          'INSERT INTO users (full_name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
          ['Administrador Principal', 'admin@salon.com', '123456', adminRoleId]
        );

        const staffUsers = [
          ['Raquel Morales',    'raquel@salon.com'],
          ['Ivania Vanegas',    'ivania@salon.com'],
          ['Marilethe Vanegas', 'marilethe@salon.com'],
          ['Blanca Palacios',   'blanca@salon.com'],
          ['Veronica Duarte',   'veronica@salon.com'],
          ['Evelyn Cano',       'evelyn@salon.com'],
        ];
        for (const s of staffUsers) {
          const [empResult]: any = await conn.execute('SELECT id FROM employees WHERE full_name = ?', [s[0]]);
          const empId = empResult[0]?.id || null;
          await conn.execute(
            'INSERT INTO users (full_name, email, password_hash, role_id, employee_id) VALUES (?, ?, ?, ?, ?)',
            [s[0], s[1], '123456', staffRoleId, empId]
          );
        }
      }

      // -------------------------------------------------------
      // SEED SERVICIOS
      // -------------------------------------------------------
      const [svcRows]: any = await conn.execute('SELECT COUNT(*) as cnt FROM services');
      if (svcRows[0].cnt === 0) {
        const services = [
          ['Afeitado premium',           'Servicio empresarial con protocolo estandarizado', 105, 78.15],
          ['Balayage',                   'Coloración técnica degradada',                      60, 33.50],
          ['Barberia completa',          'Corte, barba y limpieza',                           90, 75.80],
          ['Brushing',                   'Secado y estilizado',                               35, 10.00],
          ['Brushing premium',           'Protocolo estandarizado de secado especial',        90, 19.40],
          ['Color completo',             'Aplicación de tinte en todo el cabello',            45, 31.15],
          ['Color raiz',                 'Retoque de crecimiento',                            30, 28.80],
          ['Corte de cabello',           'Corte moderno y peinado básico',                   45, 12.00],
          ['Corte ejecutivo',            'Estilo clásico masculino',                          45, 12.35],
          ['Corte premium',              'Corte con tratamiento profundo',                    60, 14.70],
          ['Depilacion cejas',           'Perfilado con cera o hilo',                         75, 54.65],
          ['Diseno de cejas',            'Estudio morfológico y diseño',                      90, 57.00],
          ['Diseno de unas',             'Arte a mano alzada',                                60, 52.30],
          ['Hidratacion facial',         'Tratamiento revitalizante',                         60, 71.10],
          ['Laminado de cejas',          'Efecto lifting en vello de ceja',                  105, 59.35],
          ['Lavado hidratante',          'Limpieza profunda especial',                       105, 21.75],
          ['Lifting de pestanas',        'Curvatura natural prolongada',                     120, 61.70],
          ['Limpieza facial',            'Extracción e hidratación básica',                   45, 68.75],
          ['Manicure clasico',           'Cuidado básico de uñas',                           105, 40.55],
          ['Manicure gel',               'Esmaltado permanente',                             135, 45.25],
          ['Manicure spa',               'Limpieza, hidratación y esmaltado',                 60, 18.00],
          ['Maquillaje novia',           'Especial larga duración',                           30, 66.40],
          ['Maquillaje social',          'Eventos y fiestas',                                135, 64.05],
          ['Masaje relajante',           'Cuerpo completo 60min',                             75, 73.45],
          ['Matizado profesional',       'Neutralización de tonos',                           90, 38.20],
          ['Mechas clasicas',            'Reflectos tradicionales',                            75, 35.85],
          ['Paquete corporativo',        'Servicios múltiples integrados',                   120, 80.50],
          ['Pedicure clasico',           'Cuidado de pies básico',                            30, 47.60],
          ['Pedicure spa',               'Relajación y cuidado intenso',                      45, 49.95],
          ['Peinado express',            'Rápido y efectivo',                                  75, 17.05],
          ['Tinte completo',             'Color global vibrante',                             120, 35.00],
          ['Tratamiento botox capilar',  'Rejuvenecimiento de fibra',                         135, 26.45],
          ['Tratamiento keratina',       'Alisado y control de frizz',                        120, 24.10],
        ];
        for (const s of services) {
          await conn.execute(
            'INSERT INTO services (name, description, duration_minutes, price) VALUES (?, ?, ?, ?)', s
          );
        }
      }

      // -------------------------------------------------------
      // SEED CLIENTES
      // -------------------------------------------------------
      const [cliRows]: any = await conn.execute('SELECT COUNT(*) as cnt FROM clients');
      if (cliRows[0].cnt === 0) {
        const names = ['Mariana','Beatriz','Estela','Rosa','Clara','Diana','Elena','Fabiola','Gloria','Hilda','Irene','Julia','Karla','Lorena','Marta','Nadia','Olga','Paola','Raquel','Sonia','Teresa','Ursula','Valeria','Wendy','Ximena','Yara','Zoe','Ana','Carmen','Doris','Enriqueta','Felicia','Gisela','Isabel','Josefina','Laura','Monica','Patricia','Silvia','Victoria'];
        const lastNames = ['Silva','Luna','Ortiz','García','López','Martínez','Rodríguez','Pérez','Sánchez','Romero','Torres','Ruiz','Díaz','Morales','Jiménez','Moreno','Muñoz','Álvarez','Castillo','Vázquez'];
        for (let i = 0; i < 40; i++) {
          const full_name = `${names[i % names.length]} ${lastNames[i % lastNames.length]}`;
          const phone = `555${1000 + i}`;
          const email = `${names[i % names.length].toLowerCase()}${i}@email.com`;
          await conn.execute(
            'INSERT INTO clients (full_name, phone, email, notes) VALUES (?, ?, ?, ?)',
            [full_name, phone, email, 'Cliente frecuente']
          );
        }
      }

      // -------------------------------------------------------
      // SEED PRODUCTOS
      // -------------------------------------------------------
      const [prodRows]: any = await conn.execute('SELECT COUNT(*) as cnt FROM products');
      if (prodRows[0].cnt === 0) {
        const products = [
          ['Aceite capilar',      'Beauty Team',  'Cabello',    28,  11.50],
          ['Aceite reparador',    'GlowLab',      'Cabello',     4,  14.00],
          ['Acondicionador brillo','GlowLab',     'Cabello',    18,   7.30],
          ['Agua micelar',        'SkinCare Co',  'Facial',     69,  31.10],
          ['Base coat',           'NailPro',      'Uñas',       51,  22.70],
          ['Brocha profesional',  'NailPro',      'Uñas',       96,  43.70],
          ['Cera moldeadora',     'Beauty Team',  'Cabello',    42,  18.50],
          ['Crema rizos',         'NailPro',      'Cabello',    36,  15.70],
          ['Delineador liquido',  'LuxeHair',     'Maquillaje', 90,  40.90],
          ['Esmalte nude',        'LuxeHair',     'Uñas',       45,  19.90],
          ['Esmalte rojo',        'NailPro',      'Uñas',       20,   3.50],
          ['Esmalte rojo elite',  'GlowLab',      'Uñas',       48,  21.30],
          ['Exfoliante corporal', 'GlowLab',      'Cuerpo',     63,  28.30],
          ['Gel styling',         'SkinCare Co',  'Cabello',    39,  17.10],
          ['Gloss brillo',        'SkinCare Co',  'Maquillaje', 84,  38.10],
          ['Labial mate',         'NailPro',      'Maquillaje', 81,  36.70],
          ['Locion hidratante',   'NailPro',      'Cuerpo',     66,  29.70],
          ['Mascara pestanas',    'GlowLab',      'Maquillaje', 93,  42.30],
          ['Mascarilla capilar',  'SilkCare',     'Cabello',     9,  12.00],
          ['Mascarilla facial',   'LuxeHair',     'Facial',     75,  33.90],
          ['Mascarilla reparadora','NailPro',     'Cabello',    21,   8.70],
          ['Paleta sombras',      'Beauty Team',  'Maquillaje', 87,  39.50],
          ['Pinza cejas',         'SkinCare Co',  'Belleza',    99,  45.10],
          ['Protector solar',     'GlowLab',      'Solar',      78,  35.30],
          ['Protector termico',   'LuxeHair',     'Cabello',    30,  12.90],
          ['Removedor suave',     'Beauty Team',  'Uñas',       57,  25.50],
          ['Serum argan',         'SkinCare Co',  'Cabello',    24,  10.10],
          ['Shampoo nutricion',   'LuxeHair',     'Cabello',    15,   5.90],
          ['Shampoo profesional', 'LuxeHair',     'Cabello',    15,   8.50],
          ['Spray fijador',       'GlowLab',      'Cabello',    33,  14.30],
          ['Toalla premium',      'Beauty Team',  'Accesorios', 12,  46.50],
          ['Tonico facial',       'Beauty Team',  'Facial',     72,  32.50],
          ['Top coat',            'SkinCare Co',  'Uñas',       54,  24.10],
        ];
        for (const p of products) {
          await conn.execute(
            'INSERT INTO products (name, brand, category, stock, price) VALUES (?, ?, ?, ?, ?)', p
          );
        }
      }

      // -------------------------------------------------------
      // SEED PROMOCIONES
      // -------------------------------------------------------
      const [promoRows]: any = await conn.execute('SELECT COUNT(*) as cnt FROM promotions');
      if (promoRows[0].cnt === 0) {
        const promos = [
          ['Madre Radiante',   '20% de descuento en todos los servicios de color',            20.0, '2026-05-01', '2026-05-31'],
          ['Pack Amigas',      'Depilación de cejas gratis en manicure spa para dos',          10.0, '2026-05-01', '2026-06-30'],
          ['Recién Llegada',   '10% OFF en tu primera visita al salón',                       10.0, '2026-01-01', '2026-12-31'],
        ];
        for (const p of promos) {
          await conn.execute(
            'INSERT INTO promotions (title, description, discount_percent, start_date, end_date) VALUES (?, ?, ?, ?, ?)', p
          );
        }
      }

      // -------------------------------------------------------
      // SEED VENTAS DE PRUEBA
      // -------------------------------------------------------
      const [salesRows]: any = await conn.execute('SELECT COUNT(*) as cnt FROM sales');
      if (salesRows[0].cnt === 0) {
        const sales = [
          [1, 1, 'Efectivo',      'Venta servicio corte',   45.00],
          [2, 1, 'Transferencia', 'Servicio color raices',  28.80],
          [3, 1, 'Efectivo',      'Manicure premium',       45.25],
          [null,1,'Efectivo',     'Venta Aceite capilar',   11.50],
        ];
        for (const s of sales) {
          await conn.execute(
            'INSERT INTO sales (client_id, created_by_id, payment_method, notes, total) VALUES (?, ?, ?, ?, ?)', s
          );
        }

        const saleItems = [
          [1, 'service',  8, null, null, null, 1, 45.00, 45.00],
          [2, 'service', 13, null, null, null, 1, 28.80, 28.80],
          [3, 'service', 22, null, null, null, 1, 45.25, 45.25],
          [4, 'product',  1, null, null, null, 1, 11.50, 11.50],
        ];
        for (const item of saleItems) {
          await conn.execute(
            'INSERT INTO sale_items (sale_id, item_type, item_id, appointment_id, employee_id, custom_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            item
          );
        }
      }

      console.log('✅ Base de datos MySQL inicializada correctamente.');
    } finally {
      conn.release();
    }
  }

  // -------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Salon Pro Backend - MySQL Ready' });
  });

  // -------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ status: 'error', message: 'Faltan credenciales' });
    let db: any = null;
    try {
      db = await getDb();
      const user = await db.get(
        `SELECT u.id, u.full_name, u.email, u.employee_id, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.email = ? AND u.password_hash = ? AND u.active = 1`,
        [username, password]
      );
      if (user) {
        res.json({ status: 'success', user: { id: user.id, username: user.full_name, role: user.role, employee_id: user.employee_id } });
      } else {
        res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos' });
      }
    } catch (err: any) {
      console.error('Error en /api/login:', err.message || err);
      res.status(500).json({ status: 'error', message: 'Error de conexión a la base de datos' });
    } finally {
      if (db) await db.close();
    }
  });

  // -------------------------------------------------------
  // CRUD GENÉRICO
  // -------------------------------------------------------
  const entities: any[] = [
    { table: 'clients',      route: 'clients',      fields: ['full_name','phone','email','notes'],                              id_field: 'id' },
    { table: 'employees',    route: 'employees',    fields: ['full_name','specialty','phone','commission_percent'],             id_field: 'id' },
    { table: 'services',     route: 'services',     fields: ['name','description','duration_minutes','price'],                  id_field: 'id' },
    { table: 'products',     route: 'products',     fields: ['name','brand','category','price','stock'],                       id_field: 'id' },
    { table: 'appointments', route: 'appointments', fields: ['client_id','employee_id','service_id','start_time','status','notes'], id_field: 'id' },
    { table: 'promotions',   route: 'promotions',   fields: ['title','description','discount_percent','start_date','end_date','active'], id_field: 'id' },
  ];

  entities.forEach(entity => {
    // GET ALL
    app.get(`/api/${entity.route}`, async (_req, res) => {
      const db = await getDb();
      try {
        let query = `SELECT * FROM ${entity.table}`;
        if (entity.table === 'clients') query += ' ORDER BY full_name ASC';
        if (entity.table === 'appointments') {
          query = `
            SELECT a.*,
                   c.full_name as client_name,
                   e.full_name as employee_name,
                   s.name      as service_name,
                   s.price     as price,
                   DATE_FORMAT(a.start_time, '%Y-%m-%d') as date,
                   DATE_FORMAT(a.start_time, '%H:%i')    as time
            FROM appointments a
            LEFT JOIN clients   c ON a.client_id   = c.id
            LEFT JOIN employees e ON a.employee_id = e.id
            LEFT JOIN services  s ON a.service_id  = s.id
            ORDER BY a.start_time DESC
          `;
        }
        const data = await db.all(query);
        const mapped = data.map((item: any) => ({
          ...item,
          name:       item.full_name || item.name,
          commission: item.commission_percent,
        }));
        res.json(mapped);
      } finally {
        await db.close();
      }
    });

    // POST
    app.post(`/api/${entity.route}`, async (req, res) => {
      const db = await getDb();
      try {
        // Validación citas: evitar choques de horario
        if (entity.table === 'appointments') {
          const { employee_id, start_time } = req.body;
          const exists = await db.get(
            'SELECT id FROM appointments WHERE employee_id = ? AND start_time = ? AND status != "Cancelada"',
            [employee_id, start_time]
          );
          if (exists) return res.status(400).json({ message: 'La trabajadora ya tiene una cita a esa hora.' });
        }
        // Validación teléfono
        if (entity.table === 'clients' || entity.table === 'employees') {
          const phone = String(req.body.phone || '');
          if (!/^\d{8}$/.test(phone)) return res.status(400).json({ message: 'El teléfono debe tener exactamente 8 dígitos.' });
        }

        const fieldsToUse = entity.fields.filter((f: string) =>
          req.body[f === 'full_name' ? 'name' : f] !== undefined
        );
        const keys         = fieldsToUse.join(', ');
        const placeholders = fieldsToUse.map(() => '?').join(', ');
        const values       = fieldsToUse.map((f: string) => {
          const val = req.body[f === 'full_name' ? 'name' : f];
          return val === undefined ? null : val;
        });
        await db.run(`INSERT INTO ${entity.table} (${keys}) VALUES (${placeholders})`, values);
        res.status(201).json({ message: 'Success' });
      } catch (err: any) {
        res.status(500).json({ message: 'Error interno del servidor', error: err.message });
      } finally {
        await db.close();
      }
    });

    // PUT
    app.put(`/api/${entity.route}/:id`, async (req, res) => {
      const db = await getDb();
      try {
        if (entity.table === 'clients' || entity.table === 'employees') {
          const phone = String(req.body.phone || '');
          if (!/^\d{8}$/.test(phone)) return res.status(400).json({ message: 'El teléfono debe tener exactamente 8 dígitos.' });
        }
        const updates = entity.fields.map((f: string) => `${f} = ?`).join(', ');
        const values  = entity.fields.map((f: string) => {
          const val = req.body[f === 'full_name' ? 'name' : f];
          return val === undefined ? null : val;
        });
        values.push(req.params.id);
        await db.run(`UPDATE ${entity.table} SET ${updates} WHERE ${entity.id_field} = ?`, values);
        res.json({ message: 'Updated successfully' });
      } catch (err: any) {
        res.status(500).json({ message: 'Error al actualizar', error: err.message });
      } finally {
        await db.close();
      }
    });

    // DELETE
    app.delete(`/api/${entity.route}/:id`, async (req, res) => {
      const db = await getDb();
      try {
        await db.run(`DELETE FROM ${entity.table} WHERE ${entity.id_field} = ?`, [req.params.id]);
        res.json({ message: 'Deleted successfully' });
      } finally {
        await db.close();
      }
    });
  });

  // -------------------------------------------------------
  // STATS / DASHBOARD
  // -------------------------------------------------------
  app.get('/api/stats', async (_req, res) => {
    const db = await getDb();
    try {
      const clients   = await db.get('SELECT COUNT(*) as count FROM clients');
      const employees = await db.get('SELECT COUNT(*) as count FROM employees WHERE active = 1');
      const services  = await db.get('SELECT COUNT(*) as count FROM services  WHERE active = 1');
      const income    = await db.get('SELECT SUM(total) as total FROM sales WHERE DATE(created_at) = CURDATE()');
      const lowStock  = await db.get('SELECT COUNT(*) as count FROM products WHERE stock <= 5');
      res.json({
        clients_count:   clients?.count   || 0,
        employees_count: employees?.count || 0,
        services_count:  services?.count  || 0,
        today_income:    parseFloat(income?.total) || 0,
        low_stock:       lowStock?.count  || 0,
      });
    } finally {
      await db.close();
    }
  });

  // -------------------------------------------------------
  // VENTAS (con items)
  // -------------------------------------------------------
  app.get('/api/sales', async (_req, res) => {
    const db = await getDb();
    try {
      const sales = await db.all(`
        SELECT s.*, c.full_name as client_name, c.phone as client_phone, e.full_name as employee_name
        FROM sales s
        LEFT JOIN clients   c ON s.client_id   = c.id
        LEFT JOIN employees e ON s.employee_id = e.id
        ORDER BY s.created_at DESC
      `);
      for (const sale of sales) {
        if (sale.created_at) sale.created_at = String(sale.created_at);
        sale.total    = parseFloat(sale.total);
        sale.subtotal = parseFloat(sale.subtotal);
        const items = await db.all(`
          SELECT si.*,
                 e.full_name as employee_name,
                 CASE
                   WHEN si.custom_name IS NOT NULL THEN si.custom_name
                   WHEN si.item_type = 'product' THEN p.name
                   WHEN si.item_type = 'service' THEN sv.name
                   ELSE si.item_type
                 END as item_name
          FROM sale_items si
          LEFT JOIN products  p  ON si.item_type = 'product' AND si.item_id = p.id
          LEFT JOIN services  sv ON si.item_type = 'service' AND si.item_id = sv.id
          LEFT JOIN employees e  ON si.employee_id = e.id
          WHERE si.sale_id = ?
        `, [sale.id]);
        sale.items = items.map((item: any) => ({
          ...item,
          item_name: item.item_name || `${item.item_type} #${item.item_id}`,
        }));
      }
      res.json(sales);
    } finally {
      await db.close();
    }
  });

  app.delete('/api/sales/:id', async (req, res) => {
    const db = await getDb();
    try {
      await db.beginTransaction();
      await db.run('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id]);
      await db.run('DELETE FROM sales WHERE id = ?', [req.params.id]);
      await db.commit();
      res.json({ message: 'Venta eliminada' });
    } catch (err: any) {
      await db.rollback();
      res.status(500).json({ message: 'Error al eliminar venta', error: err.message });
    } finally {
      await db.close();
    }
  });

  // -------------------------------------------------------
  // VENTAS DETALLADAS (venta directa con items)
  // -------------------------------------------------------
  app.post('/api/sales_detailed', async (req, res) => {
    const { client_id, created_by_id, payment_method, payment_detail, notes, total,
            items, employee_id, appointment_id, promotion_title,
            promotion_discount, discount_amount, subtotal } = req.body;
    const db = await getDb();
    try {
      await db.beginTransaction();
      const appointmentItem = (items || []).find((item: any) => item.appointment_id);
      const finalAppointmentId = appointment_id || appointmentItem?.appointment_id || null;
      const finalEmployeeId    = employee_id    || appointmentItem?.employee_id    || null;

      const saleResult = await db.run(
        `INSERT INTO sales
           (client_id, created_by_id, payment_method, payment_detail, employee_id,
            appointment_id, promotion_title, promotion_discount, discount_amount, subtotal, notes, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [client_id, created_by_id, payment_method, payment_detail, finalEmployeeId,
         finalAppointmentId, promotion_title || null, promotion_discount || 0,
         discount_amount || 0, subtotal || total, notes, total]
      );
      const saleId = saleResult.lastID;

      console.log("BODY SALES:", JSON.stringify(req.body, null, 2));

      for (const item of items) {
        if (item.type === 'product') {
          const product = await db.get('SELECT stock, name FROM products WHERE id = ?', [item.id]);
          if (!product || product.stock < item.quantity) {
            throw new Error(`Stock insuficiente para ${product?.name || 'producto'}`);
          }
        }
        console.log("ITEM RECIBIDO:", JSON.stringify(item, null, 2));
        await db.run(
  `INSERT INTO sale_items
     (sale_id, item_type, item_id, appointment_id, employee_id, custom_name, quantity, unit_price, subtotal)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    saleId,
    item.type || 'product',
    item.id ?? null,
    item.appointment_id ?? null,
    item.employee_id ?? null,
    item.name ?? null,
    item.quantity ?? 1,
    item.price ?? 0,
    (item.quantity ?? 1) * (item.price ?? 0)
  ]
);
        if (item.type === 'product') {
          await db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
        }
        if (item.appointment_id) {
          await db.run('UPDATE appointments SET status = "Completada" WHERE id = ?', [item.appointment_id]);
        }
      }
      await db.commit();
      res.status(201).json({ message: 'Venta creada con éxito', saleId });
    } catch (err: any) {
  console.error("ERROR SALES_DETAILED:", err);

  await db.rollback();

  res.status(500).json({
    message: 'Error al procesar la venta',
    error: err.message,
    stack: err.stack
  });
} finally {
      await db.close();
    }
  });

  // -------------------------------------------------------
  // CHECKOUT DE CITA
  // -------------------------------------------------------
  app.post('/api/appointments/:id/checkout', async (req, res) => {
    const appointmentId = req.params.id;
    const { payment_method, payment_detail, notes, items, total,
            created_by_id, promotion_title, promotion_discount,
            discount_amount, subtotal } = req.body;
    const db = await getDb();
    try {
      await db.beginTransaction();
      const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
      if (!appointment) throw new Error('Cita no encontrada');

      const appointmentTime = new Date(appointment.start_time);
      if (appointmentTime > new Date()) {
        throw new Error('El pago de la cita sólo se permite después de la fecha y hora programada.');
      }
      if (appointment.status !== 'Programada') {
        throw new Error('La cita ya no está en estado programada.');
      }

      const saleResult = await db.run(
        `INSERT INTO sales
           (client_id, created_by_id, payment_method, payment_detail, employee_id,
            appointment_id, promotion_title, promotion_discount, discount_amount, subtotal, notes, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [appointment.client_id, created_by_id, payment_method, payment_detail,
         appointment.employee_id, appointment.id, promotion_title || null,
         promotion_discount || 0, discount_amount || 0, subtotal || total, notes, total]
      );
      const saleId = saleResult.lastID;

      for (const item of items) {
        if (item.type === 'product') {
          const product = await db.get('SELECT stock, name FROM products WHERE id = ?', [item.id]);
          if (!product || product.stock < (item.quantity || 1)) {
            throw new Error(`Stock insuficiente para ${product?.name || 'producto'}`);
          }
        }
        await db.run(
          `INSERT INTO sale_items
             (sale_id, item_type, item_id, appointment_id, employee_id, custom_name, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [saleId, item.type || 'service', item.id,
           item.appointment_id || null, item.employee_id || null, item.name || null,
           item.quantity || 1, item.price, (item.quantity || 1) * item.price]
        );
        if (item.type === 'product') {
          await db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
        }
      }
      await db.run('UPDATE appointments SET status = "Completada" WHERE id = ?', [appointmentId]);
      for (const item of items) {
        if (item.appointment_id) {
          await db.run('UPDATE appointments SET status = "Completada" WHERE id = ?', [item.appointment_id]);
        }
      }
      await db.commit();
      res.json({ message: 'Checkout realizado con éxito', saleId });
    } catch (err: any) {
      await db.rollback();
      res.status(500).json({ message: 'Error en checkout', error: err.message });
    } finally {
      await db.close();
    }
  });

  // -------------------------------------------------------
  // FRONTEND (Vite en dev opcional, estático en producción)
  // -------------------------------------------------------
  // Para evitar que se inicien dos instancias de Vite (una con "vite" y otra
  // desde este servidor), solo arrancamos el middleware de Vite cuando se
  // establezca explícitamente la variable USE_VITE_MIDDLEWARE=true.
  if (process.env.NODE_ENV !== 'production' && process.env.USE_VITE_MIDDLEWARE === 'true') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 5000;

  // Probar conexión al pool antes de inicializar la base de datos
  const poolOk = await testPoolConnection();
  if (!poolOk) {
    console.error('No se pudo establecer conexión con MySQL. Revisa DB_HOST/DB_USER/DB_PASSWORD/DB_NAME.');
    process.exit(1);
  }

  try {
    await initDb();
  } catch (err: any) {
    console.error('Error inicializando la base de datos:', err.message || err);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server MySQL corriendo en http://localhost:${PORT}`);
  });
}

startServer();
