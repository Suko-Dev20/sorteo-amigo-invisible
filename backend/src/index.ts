import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkDbConnection, dbConfig } from './config/db.js';
import { drawsRouter } from './routes/draws.js';
import { revealRouter } from './routes/reveal.js';
import { whatsappRouter } from './routes/whatsapp.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

// Salud del servidor y estado de MySQL (XAMPP)
app.get('/api/health', async (_req, res) => {
  const db = await checkDbConnection();
  res.json({
    ok: db.ok,
    service: 'amigo-invisible-api',
    database: {
      connected: db.ok,
      host: dbConfig.host,
      port: dbConfig.port,
      name: dbConfig.database,
      error: db.error || null,
    },
  });
});

app.use('/api/draws', drawsRouter);
app.use('/api/reveal', revealRouter);
app.use('/api/whatsapp', whatsappRouter);

// Manejador de errores global
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error en API:', err);
  const code = (err as { code?: string })?.code;

  if (code === 'ECONNREFUSED' || code === 'ER_BAD_DB_ERROR') {
    res.status(503).json({
      error:
        code === 'ER_BAD_DB_ERROR'
          ? `La base de datos '${dbConfig.database}' no existe aún. Ejecuta "npm run db:init" o importa db/schema.sql en phpMyAdmin.`
          : 'No se pudo conectar a MySQL. Asegúrate de haber arrancado MySQL en el panel de XAMPP.',
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Error interno del servidor';
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`🎄 API Amigo Invisible escuchando en http://localhost:${PORT}`);
  console.log(`🗄️  MySQL configurado en ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
});
