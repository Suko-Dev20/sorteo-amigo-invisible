import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { runSecretSantaDraw } from '../services/drawAlgorithm.js';
import {
  buildSecretSantaMessage,
  buildWaMeUrl,
  sendSecretSantaNotification,
} from '../services/whatsappService.js';
import type {
  AssignmentPublicView,
  Draw,
  Exclusion,
  MessageContentMode,
  NotificationLog,
  Participant,
  WhatsAppProviderType,
} from '../types/index.js';

export const drawsRouter = Router();

const createDrawSchema = z.object({
  title: z.string().trim().min(2, 'El título debe tener al menos 2 caracteres').max(150),
  event_date: z.string().trim().optional().nullable(),
  budget: z.union([z.number().nonnegative(), z.string()]).optional().nullable(),
  currency: z.string().trim().min(1).max(10).optional().default('€'),
  custom_message: z.string().max(1500).optional().nullable(),
  avoid_reciprocal: z.boolean().optional().default(true),
  anti_spoiler: z.boolean().optional().default(true),
});

const updateDrawSchema = createDrawSchema.partial();

const participantSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  phone: z
    .string()
    .trim()
    .min(6, 'Introduce un teléfono válido con prefijo (ej: +34 600 111 222)')
    .max(30),
  wishlist: z.string().max(1000).optional().nullable(),
});

const exclusionSchema = z.object({
  giver_id: z.number().int().positive(),
  excluded_receiver_id: z.number().int().positive(),
  bidirectional: z.boolean().optional().default(false),
});

const sendSchema = z.object({
  provider: z.enum(['simulator', 'wame', 'baileys', 'meta_cloud']).default('simulator'),
  contentMode: z.enum(['secret_link', 'direct_name']).default('secret_link'),
  forceResend: z.boolean().optional().default(false),
  publicBaseUrl: z.string().url().optional(),
});

function parseBudget(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function getBaseWebUrl(override?: string): string {
  const raw = override || process.env.PUBLIC_WEB_URL || 'http://localhost:5173';
  return raw.replace(/\/+$/, '');
}

function mapDrawRow(row: RowDataPacket): Draw {
  return {
    id: row.id,
    title: row.title,
    event_date: row.event_date || null,
    budget: row.budget !== null && row.budget !== undefined ? Number(row.budget) : null,
    currency: row.currency || '€',
    custom_message: row.custom_message || null,
    avoid_reciprocal: Boolean(row.avoid_reciprocal),
    anti_spoiler: Boolean(row.anti_spoiler),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    participant_count:
      row.participant_count !== undefined ? Number(row.participant_count) : undefined,
    sent_count: row.sent_count !== undefined ? Number(row.sent_count) : undefined,
    revealed_count: row.revealed_count !== undefined ? Number(row.revealed_count) : undefined,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// GET /api/draws - Listar todos los sorteos con estadísticas
// ============================================================================
drawsRouter.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        d.*,
        (SELECT COUNT(*) FROM participants p WHERE p.draw_id = d.id) AS participant_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.draw_id = d.id AND a.whatsapp_status = 'sent') AS sent_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.draw_id = d.id AND a.revealed_at IS NOT NULL) AS revealed_count
      FROM draws d
      ORDER BY d.created_at DESC`
    );

    res.json({ draws: rows.map(mapDrawRow) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/draws - Crear un nuevo sorteo
// ============================================================================
drawsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createDrawSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
      return;
    }

    const d = parsed.data;
    const budget = parseBudget(d.budget);
    const eventDate = d.event_date && d.event_date.length > 0 ? d.event_date : null;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO draws (title, event_date, budget, currency, custom_message, avoid_reciprocal, anti_spoiler)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        d.title,
        eventDate,
        budget,
        d.currency || '€',
        d.custom_message || null,
        d.avoid_reciprocal ? 1 : 0,
        d.anti_spoiler ? 1 : 0,
      ]
    );

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM draws WHERE id = ?', [
      result.insertId,
    ]);
    res.status(201).json({ draw: mapDrawRow(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/draws/:id - Obtener detalle completo de un sorteo
// ============================================================================
drawsRouter.get('/:id', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    if (!Number.isInteger(drawId) || drawId <= 0) {
      res.status(400).json({ error: 'ID de sorteo inválido.' });
      return;
    }

    const [drawRows] = await pool.query<RowDataPacket[]>('SELECT * FROM draws WHERE id = ?', [
      drawId,
    ]);
    if (drawRows.length === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }

    const draw = mapDrawRow(drawRows[0]);
    const baseUrl = getBaseWebUrl(
      typeof req.query.publicBaseUrl === 'string' ? req.query.publicBaseUrl : undefined
    );

    const [participantRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY id ASC',
      [drawId]
    );
    const participants = participantRows as unknown as Participant[];

    const [exclusionRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        e.id,
        e.draw_id,
        e.giver_id,
        e.excluded_receiver_id,
        g.name AS giver_name,
        r.name AS excluded_receiver_name
      FROM exclusions e
      INNER JOIN participants g ON g.id = e.giver_id
      INNER JOIN participants r ON r.id = e.excluded_receiver_id
      WHERE e.draw_id = ?
      ORDER BY e.id ASC`,
      [drawId]
    );
    const exclusions = exclusionRows as unknown as Exclusion[];

    const [assignmentRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        a.id,
        a.draw_id,
        a.giver_id,
        a.receiver_id,
        a.reveal_token,
        a.whatsapp_status,
        a.sent_at,
        a.revealed_at,
        g.name AS giver_name,
        g.phone AS giver_phone,
        r.name AS receiver_name,
        r.wishlist AS receiver_wishlist
      FROM assignments a
      INNER JOIN participants g ON g.id = a.giver_id
      INNER JOIN participants r ON r.id = a.receiver_id
      WHERE a.draw_id = ?
      ORDER BY g.name ASC`,
      [drawId]
    );

    const assignments: AssignmentPublicView[] = assignmentRows.map((row) => {
      const revealUrl = `${baseUrl}/revelar/${row.reveal_token}`;
      // Para el enlace wa.me pre-construido, si anti_spoiler está activo usamos siempre enlace secreto
      const wameContentMode: MessageContentMode = draw.anti_spoiler ? 'secret_link' : 'secret_link';
      const wameText = buildSecretSantaMessage({
        giverName: row.giver_name,
        receiverName: row.receiver_name,
        receiverWishlist: row.receiver_wishlist,
        drawTitle: draw.title,
        eventDate: draw.event_date,
        budget: draw.budget,
        currency: draw.currency,
        revealUrl,
        customTemplate: draw.custom_message,
        contentMode: wameContentMode,
      });

      const item: AssignmentPublicView = {
        id: row.id,
        draw_id: row.draw_id,
        giver_id: row.giver_id,
        giver_name: row.giver_name,
        giver_phone: row.giver_phone,
        reveal_token: row.reveal_token,
        reveal_url: revealUrl,
        wame_url: buildWaMeUrl(row.giver_phone, wameText),
        whatsapp_status: row.whatsapp_status,
        sent_at: row.sent_at,
        revealed_at: row.revealed_at,
      };

      if (!draw.anti_spoiler) {
        item.receiver_name = row.receiver_name;
      }

      return item;
    });

    const [logRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        l.id,
        l.assignment_id,
        g.name AS giver_name,
        l.provider,
        l.status,
        l.message_preview,
        l.detail,
        l.created_at
      FROM notification_logs l
      INNER JOIN assignments a ON a.id = l.assignment_id
      INNER JOIN participants g ON g.id = a.giver_id
      WHERE a.draw_id = ?
      ORDER BY l.created_at DESC
      LIMIT 50`,
      [drawId]
    );

    res.json({
      draw,
      participants,
      exclusions,
      assignments,
      logs: logRows as unknown as NotificationLog[],
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PATCH /api/draws/:id - Actualizar configuración del sorteo
// ============================================================================
drawsRouter.patch('/:id', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const parsed = updateDrawSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
      return;
    }

    const d = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];

    if (d.title !== undefined) {
      fields.push('title = ?');
      values.push(d.title);
    }
    if (d.event_date !== undefined) {
      fields.push('event_date = ?');
      values.push(d.event_date && d.event_date.length > 0 ? d.event_date : null);
    }
    if (d.budget !== undefined) {
      fields.push('budget = ?');
      values.push(parseBudget(d.budget));
    }
    if (d.currency !== undefined) {
      fields.push('currency = ?');
      values.push(d.currency);
    }
    if (d.custom_message !== undefined) {
      fields.push('custom_message = ?');
      values.push(d.custom_message || null);
    }
    if (d.avoid_reciprocal !== undefined) {
      fields.push('avoid_reciprocal = ?');
      values.push(d.avoid_reciprocal ? 1 : 0);
    }
    if (d.anti_spoiler !== undefined) {
      fields.push('anti_spoiler = ?');
      values.push(d.anti_spoiler ? 1 : 0);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No hay cambios para guardar.' });
      return;
    }

    values.push(drawId);
    await pool.query(`UPDATE draws SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM draws WHERE id = ?', [drawId]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }

    res.json({ draw: mapDrawRow(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE /api/draws/:id - Eliminar un sorteo
// ============================================================================
drawsRouter.delete('/:id', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM draws WHERE id = ?', [drawId]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/draws/:id/participants - Añadir participante
// ============================================================================
drawsRouter.post('/:id/participants', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const [drawRows] = await pool.query<RowDataPacket[]>('SELECT status FROM draws WHERE id = ?', [
      drawId,
    ]);
    if (drawRows.length === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }
    if (drawRows[0].status !== 'draft') {
      res.status(409).json({
        error: 'El sorteo ya se ha realizado. Reinícialo si necesitas añadir más participantes.',
      });
      return;
    }

    const parsed = participantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
      return;
    }

    const { name, phone, wishlist } = parsed.data;
    const cleanPhone = phone.replace(/\s+/g, ' ').trim();

    try {
      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO participants (draw_id, name, phone, wishlist) VALUES (?, ?, ?, ?)',
        [drawId, name, cleanPhone, wishlist?.trim() || null]
      );
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM participants WHERE id = ?', [
        result.insertId,
      ]);
      res.status(201).json({ participant: rows[0] });
    } catch (dbErr: unknown) {
      if ((dbErr as { code?: string })?.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          error: 'Ya existe un participante con ese número de teléfono en este sorteo.',
        });
        return;
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PATCH /api/draws/:id/participants/:pid - Editar participante (permite corregir teléfono tras sortear)
// ============================================================================
drawsRouter.patch('/:id/participants/:pid', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const pid = Number(req.params.pid);

    const parsed = participantSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
      return;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (parsed.data.name !== undefined) {
      fields.push('name = ?');
      values.push(parsed.data.name);
    }
    if (parsed.data.phone !== undefined) {
      fields.push('phone = ?');
      values.push(parsed.data.phone.replace(/\s+/g, ' ').trim());
    }
    if (parsed.data.wishlist !== undefined) {
      fields.push('wishlist = ?');
      values.push(parsed.data.wishlist?.trim() || null);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No hay cambios para guardar.' });
      return;
    }

    values.push(pid, drawId);
    try {
      await pool.query(
        `UPDATE participants SET ${fields.join(', ')} WHERE id = ? AND draw_id = ?`,
        values
      );
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM participants WHERE id = ? AND draw_id = ?',
        [pid, drawId]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'Participante no encontrado.' });
        return;
      }
      res.json({ participant: rows[0] });
    } catch (dbErr: unknown) {
      if ((dbErr as { code?: string })?.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          error: 'Ese número de teléfono ya está asignado a otro participante.',
        });
        return;
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE /api/draws/:id/participants/:pid - Eliminar participante
// ============================================================================
drawsRouter.delete('/:id/participants/:pid', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const pid = Number(req.params.pid);

    const [drawRows] = await pool.query<RowDataPacket[]>('SELECT status FROM draws WHERE id = ?', [
      drawId,
    ]);
    if (drawRows.length === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }
    if (drawRows[0].status !== 'draft') {
      res.status(409).json({
        error: 'Reinicia el sorteo antes de eliminar participantes.',
      });
      return;
    }

    await pool.query('DELETE FROM participants WHERE id = ? AND draw_id = ?', [pid, drawId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/draws/:id/exclusions - Añadir exclusión (una dirección o bidireccional)
// ============================================================================
drawsRouter.post('/:id/exclusions', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const [drawRows] = await pool.query<RowDataPacket[]>('SELECT status FROM draws WHERE id = ?', [
      drawId,
    ]);
    if (drawRows.length === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }
    if (drawRows[0].status !== 'draft') {
      res.status(409).json({ error: 'Reinicia el sorteo para modificar exclusiones.' });
      return;
    }

    const parsed = exclusionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos de exclusión inválidos.' });
      return;
    }

    const { giver_id, excluded_receiver_id, bidirectional } = parsed.data;
    if (giver_id === excluded_receiver_id) {
      res.status(400).json({ error: 'Un participante ya tiene prohibido regalarse a sí mismo.' });
      return;
    }

    await pool.query(
      'INSERT IGNORE INTO exclusions (draw_id, giver_id, excluded_receiver_id) VALUES (?, ?, ?)',
      [drawId, giver_id, excluded_receiver_id]
    );

    if (bidirectional) {
      await pool.query(
        'INSERT IGNORE INTO exclusions (draw_id, giver_id, excluded_receiver_id) VALUES (?, ?, ?)',
        [drawId, excluded_receiver_id, giver_id]
      );
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE /api/draws/:id/exclusions/:eid - Eliminar exclusión
// ============================================================================
drawsRouter.delete('/:id/exclusions/:eid', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const eid = Number(req.params.eid);
    await pool.query('DELETE FROM exclusions WHERE id = ? AND draw_id = ?', [eid, drawId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/draws/:id/run - Ejecutar el sorteo de Amigo Invisible
// ============================================================================
drawsRouter.post('/:id/run', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const drawId = Number(req.params.id);
    const [drawRows] = await conn.query<RowDataPacket[]>('SELECT * FROM draws WHERE id = ?', [
      drawId,
    ]);
    if (drawRows.length === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }

    const draw = mapDrawRow(drawRows[0]);
    const [pRows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM participants WHERE draw_id = ?',
      [drawId]
    );
    const [eRows] = await conn.query<RowDataPacket[]>(
      'SELECT giver_id, excluded_receiver_id FROM exclusions WHERE draw_id = ?',
      [drawId]
    );

    const algorithmResult = runSecretSantaDraw({
      participantIds: pRows.map((p) => Number(p.id)),
      exclusions: eRows.map((e) => ({
        giverId: Number(e.giver_id),
        excludedReceiverId: Number(e.excluded_receiver_id),
      })),
      avoidReciprocal: draw.avoid_reciprocal,
    });

    if (!algorithmResult.success) {
      res.status(422).json({ error: algorithmResult.error });
      return;
    }

    await conn.beginTransaction();
    await conn.query('DELETE FROM assignments WHERE draw_id = ?', [drawId]);

    for (const pair of algorithmResult.pairs) {
      await conn.query(
        `INSERT INTO assignments (draw_id, giver_id, receiver_id, reveal_token, whatsapp_status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [drawId, pair.giverId, pair.receiverId, pair.revealToken]
      );
    }

    await conn.query("UPDATE draws SET status = 'drawn' WHERE id = ?", [drawId]);
    await conn.commit();

    res.json({ ok: true, count: algorithmResult.pairs.length });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
});

// ============================================================================
// POST /api/draws/:id/reset - Reiniciar sorteo a borrador
// ============================================================================
drawsRouter.post('/:id/reset', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const drawId = Number(req.params.id);
    await conn.beginTransaction();
    await conn.query('DELETE FROM assignments WHERE draw_id = ?', [drawId]);
    await conn.query("UPDATE draws SET status = 'draft' WHERE id = ?", [drawId]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
});

// ============================================================================
// Helper para enviar una asignación individual y registrar log en MySQL
// ============================================================================
interface AssignmentFullRow extends RowDataPacket {
  id: number;
  draw_id: number;
  reveal_token: string;
  whatsapp_status: string;
  giver_name: string;
  giver_phone: string;
  receiver_name: string;
  receiver_wishlist: string | null;
}

async function processSingleSend(
  draw: Draw,
  row: AssignmentFullRow,
  provider: WhatsAppProviderType,
  contentMode: MessageContentMode,
  baseUrl: string
) {
  const revealUrl = `${baseUrl}/revelar/${row.reveal_token}`;
  const result = await sendSecretSantaNotification(
    provider,
    row.giver_phone,
    {
      giverName: row.giver_name,
      receiverName: row.receiver_name,
      receiverWishlist: row.receiver_wishlist,
      drawTitle: draw.title,
      eventDate: draw.event_date,
      budget: draw.budget,
      currency: draw.currency,
      revealUrl,
      customTemplate: draw.custom_message,
      contentMode,
    },
    draw.anti_spoiler
  );

  const newStatus = result.ok ? 'sent' : 'failed';
  await pool.query(
    `UPDATE assignments
     SET whatsapp_status = ?, sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
     WHERE id = ?`,
    [newStatus, newStatus, row.id]
  );

  await pool.query(
    `INSERT INTO notification_logs (assignment_id, provider, status, message_preview, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [row.id, provider, result.status, result.messagePreview, result.detail]
  );

  return result;
}

// ============================================================================
// POST /api/draws/:id/send - Envío masivo a todos los participantes pendientes
// ============================================================================
drawsRouter.post('/:id/send', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Parámetros de envío inválidos.' });
      return;
    }

    const { provider, contentMode, forceResend, publicBaseUrl } = parsed.data;
    if (provider === 'wame') {
      res.status(400).json({
        error: 'El modo wa.me se envía individualmente pulsando el botón de cada participante.',
      });
      return;
    }

    const [drawRows] = await pool.query<RowDataPacket[]>('SELECT * FROM draws WHERE id = ?', [
      drawId,
    ]);
    if (drawRows.length === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }
    const draw = mapDrawRow(drawRows[0]);

    const statusFilter = forceResend ? '' : "AND a.whatsapp_status <> 'sent'";
    const [rows] = await pool.query<AssignmentFullRow[]>(
      `SELECT
        a.id,
        a.draw_id,
        a.reveal_token,
        a.whatsapp_status,
        g.name AS giver_name,
        g.phone AS giver_phone,
        r.name AS receiver_name,
        r.wishlist AS receiver_wishlist
      FROM assignments a
      INNER JOIN participants g ON g.id = a.giver_id
      INNER JOIN participants r ON r.id = a.receiver_id
      WHERE a.draw_id = ? ${statusFilter}
      ORDER BY a.id ASC`,
      [drawId]
    );

    if (rows.length === 0) {
      res.json({ ok: true, sent: 0, failed: 0, message: 'No hay mensajes pendientes por enviar.' });
      return;
    }

    const baseUrl = getBaseWebUrl(publicBaseUrl);
    let sent = 0;
    let failed = 0;
    const results: Array<{ giverName: string; ok: boolean; detail: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const r = await processSingleSend(draw, row, provider, contentMode, baseUrl);
      if (r.ok) sent++;
      else failed++;
      results.push({ giverName: row.giver_name, ok: r.ok, detail: r.detail });

      // Retardo humano aleatorio (2.5s - 4.5s) entre envíos reales por WhatsApp QR
      if (provider === 'baileys' && i < rows.length - 1) {
        const delayMs = 2500 + Math.floor(Math.random() * 2000);
        await sleep(delayMs);
      }
    }

    // Si todos quedaron enviados, marcar el sorteo como 'sent'
    const [pendingRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM assignments WHERE draw_id = ? AND whatsapp_status <> 'sent'",
      [drawId]
    );
    if (Number(pendingRows[0]?.cnt ?? 1) === 0) {
      await pool.query("UPDATE draws SET status = 'sent' WHERE id = ?", [drawId]);
    }

    res.json({ ok: failed === 0, sent, failed, results });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/draws/:id/assignments/:aid/send - Envío / registro individual
// ============================================================================
drawsRouter.post('/:id/assignments/:aid/send', async (req, res, next) => {
  try {
    const drawId = Number(req.params.id);
    const aid = Number(req.params.aid);
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Parámetros de envío inválidos.' });
      return;
    }

    const { provider, contentMode, publicBaseUrl } = parsed.data;

    const [drawRows] = await pool.query<RowDataPacket[]>('SELECT * FROM draws WHERE id = ?', [
      drawId,
    ]);
    if (drawRows.length === 0) {
      res.status(404).json({ error: 'Sorteo no encontrado.' });
      return;
    }
    const draw = mapDrawRow(drawRows[0]);

    const [rows] = await pool.query<AssignmentFullRow[]>(
      `SELECT
        a.id,
        a.draw_id,
        a.reveal_token,
        a.whatsapp_status,
        g.name AS giver_name,
        g.phone AS giver_phone,
        r.name AS receiver_name,
        r.wishlist AS receiver_wishlist
      FROM assignments a
      INNER JOIN participants g ON g.id = a.giver_id
      INNER JOIN participants r ON r.id = a.receiver_id
      WHERE a.draw_id = ? AND a.id = ?
      LIMIT 1`,
      [drawId, aid]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Asignación no encontrada.' });
      return;
    }

    const baseUrl = getBaseWebUrl(publicBaseUrl);
    const result = await processSingleSend(draw, rows[0], provider, contentMode, baseUrl);

    const [pendingRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM assignments WHERE draw_id = ? AND whatsapp_status <> 'sent'",
      [drawId]
    );
    if (Number(pendingRows[0]?.cnt ?? 1) === 0) {
      await pool.query("UPDATE draws SET status = 'sent' WHERE id = ?", [drawId]);
    }

    res.json({ ok: result.ok, result });
  } catch (err) {
    next(err);
  }
});
