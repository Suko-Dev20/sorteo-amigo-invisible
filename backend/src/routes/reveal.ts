import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/db.js';

export const revealRouter = Router();

interface RevealRow extends RowDataPacket {
  assignment_id: number;
  draw_title: string;
  event_date: string | null;
  budget: string | null;
  currency: string;
  custom_message: string | null;
  giver_name: string;
  receiver_name: string;
  receiver_wishlist: string | null;
  revealed_at: string | null;
}

revealRouter.get('/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token || token.length < 16) {
      res.status(404).json({ error: 'Enlace secreto no válido o incompleto.' });
      return;
    }

    const [rows] = await pool.query<RevealRow[]>(
      `SELECT
        a.id AS assignment_id,
        d.title AS draw_title,
        d.event_date,
        d.budget,
        d.currency,
        d.custom_message,
        g.name AS giver_name,
        r.name AS receiver_name,
        r.wishlist AS receiver_wishlist,
        a.revealed_at
      FROM assignments a
      INNER JOIN draws d ON d.id = a.draw_id
      INNER JOIN participants g ON g.id = a.giver_id
      INNER JOIN participants r ON r.id = a.receiver_id
      WHERE a.reveal_token = ?
      LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      res.status(404).json({
        error: 'Este sobre secreto no existe o el sorteo fue reiniciado por el organizador.',
      });
      return;
    }

    const row = rows[0];

    res.json({
      drawTitle: row.draw_title,
      eventDate: row.event_date,
      budget: row.budget !== null ? Number(row.budget) : null,
      currency: row.currency,
      giverName: row.giver_name,
      receiverName: row.receiver_name,
      receiverWishlist: row.receiver_wishlist,
      alreadyRevealed: Boolean(row.revealed_at),
      revealedAt: row.revealed_at,
    });
  } catch (err) {
    next(err);
  }
});

revealRouter.post('/:token/open', async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) {
      res.status(400).json({ error: 'Token inválido.' });
      return;
    }

    await pool.query(
      `UPDATE assignments
       SET revealed_at = COALESCE(revealed_at, CURRENT_TIMESTAMP)
       WHERE reveal_token = ?`,
      [token]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
