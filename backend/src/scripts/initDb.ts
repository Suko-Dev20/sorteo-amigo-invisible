import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'amigo_invisible';

  const schemaPath = path.resolve(__dirname, '../../../db/schema.sql');
  console.log(`📄 Leyendo esquema desde: ${schemaPath}`);
  const sql = await fs.readFile(schemaPath, 'utf8');

  console.log(`🔌 Conectando a MySQL en ${host}:${port} (usuario: ${user})...`);
  let connection: mysql.Connection | undefined;

  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      charset: 'utf8mb4',
    });

    await connection.query(sql);
    console.log(`✅ Base de datos '${dbName}' y tablas creadas/verificadas correctamente.`);
    console.log(`💡 Ya puedes abrir http://localhost/phpmyadmin para explorar tus tablas.`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Error al inicializar la base de datos:', message);
    console.error('👉 Asegúrate de haber iniciado el servicio MySQL en el Panel de Control de XAMPP.');
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDb();
