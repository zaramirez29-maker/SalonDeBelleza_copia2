import mysql from 'mysql2/promise';

let pool: mysql.Pool;

export async function getDb() {

  if (!pool) {

    pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'salon_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('MYSQL CONNECTED');
  }

  return {

    async all(query: string, params: any[] = []) {

      const [rows] = await pool.query(query, params);
      return rows;
    },

    async get(query: string, params: any[] = []) {

      const [rows]: any = await pool.query(query, params);
      return rows[0];
    },

    async run(query: string, params: any[] = []) {

      const [result] = await pool.query(query, params);
      return result;
    },

    async exec(query: string) {

      await pool.query(query);
    }
  };
}