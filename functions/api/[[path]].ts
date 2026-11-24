/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  META_WHATSAPP_TOKEN?: string;
  META_PHONE_NUMBER_ID?: string;
  META_API_VERSION?: string;
}

type MessageContentMode = 'secret_link' | 'direct_name';
type WhatsAppProviderType = 'simulator' | 'wame' | 'baileys' | 'meta_cloud';

interface DrawRow {
  id: number;
  admin_token: string;
  title: string;
  event_date: string | null;
  budget: number | null;
  currency: string;
  custom_message: string | null;
  avoid_reciprocal: number;
  anti_spoiler: number;
  status: 'draft' | 'drawn' | 'sent';
  created_at: string;
  updated_at: string;
  participant_count?: number;
  sent_count?: number;
  revealed_count?: number;
}

// ============================================================================
// Helpers Web Crypto & Respuestas JSON
// ============================================================================
function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomInt(maxExclusive: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % maxExclusive;
}

function secureShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function mapDraw(row: DrawRow) {
  return {
    id: row.id,
    admin_token: row.admin_token,
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

function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

function formatDateEs(dateStr?: string | null): string {
  if (!dateStr) return 'Por confirmar';
  const [y, m, d] = dateStr.split('-');
  return y && m && d ? `${d}/${m}/${y}` : dateStr;
}

function buildSecretSantaMessage(ctx: {
  giverName: string;
  receiverName: string;
  receiverWishlist?: string | null;
  drawTitle: string;
  eventDate?: string | null;
  budget?: number | null;
  currency?: string;
  revealUrl: string;
  customTemplate?: string | null;
  contentMode: MessageContentMode;
}): string {
  const budgetText =
    ctx.budget !== null && ctx.budget !== undefined
      ? `${Number(ctx.budget).toFixed(2).replace(/\.00$/, '')}${ctx.currency || '€'}`
      : 'Libre';
  const dateText = formatDateEs(ctx.eventDate);
  const wishlistText = ctx.receiverWishlist?.trim()
    ? `💡 Ideas de regalo: ${ctx.receiverWishlist.trim()}`
    : '';

  if (ctx.customTemplate && ctx.customTemplate.trim().length > 0) {
    let msg = ctx.customTemplate
      .trim()
      .replaceAll('{nombre}', ctx.giverName)
      .replaceAll('{sorteo}', ctx.drawTitle)
      .replaceAll('{presupuesto}', budgetText)
      .replaceAll('{fecha}', dateText)
      .replaceAll('{enlace}', ctx.revealUrl);

    if (ctx.contentMode === 'direct_name') {
      msg = msg.replaceAll('{amigo}', ctx.receiverName).replaceAll('{deseos}', wishlistText);
    } else {
      msg = msg.replaceAll('{amigo}', '[Descúbrelo en el enlace]').replaceAll('{deseos}', '');
      if (!msg.includes(ctx.revealUrl)) {
        msg += `\n\n🎁 Abre tu sobre secreto aquí:\n${ctx.revealUrl}`;
      }
    }
    return msg.trim();
  }

  if (ctx.contentMode === 'direct_name') {
    const lines = [
      `🎄 *¡Hola ${ctx.giverName}!* 🎅`,
      `Ya se ha realizado el sorteo de *${ctx.drawTitle}*.`,
      ``,
      `🎁 Te ha tocado regalar a: *${ctx.receiverName}*`,
      wishlistText,
      `💰 Presupuesto sugerido: *${budgetText}*`,
      `📅 Fecha del intercambio: *${dateText}*`,
      ``,
      `🤫 ¡Recuerda mantener el secreto hasta Navidad! ✨`,
    ];
    return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
  }

  return [
    `🎄 *¡Hola ${ctx.giverName}!* 🎅`,
    `Ya está listo el sorteo de *${ctx.drawTitle}*.`,
    ``,
    `💰 Presupuesto sugerido: *${budgetText}*`,
    `📅 Fecha del intercambio: *${dateText}*`,
    ``,
    `🎁 Pulsa en tu sobre mágico secreto para descubrir a quién te toca regalar:`,
    ctx.revealUrl,
    ``,
    `🤫 ¡No compartas este enlace con nadie! ✨`,
  ].join('\n');
}

function buildWaMeUrl(phone: string, text: string): string {
  return `https://wa.me/${normalizePhoneDigits(phone)}?text=${encodeURIComponent(text)}`;
}

// ============================================================================
// Algoritmo de Sorteo con Backtracking + MRV (Edge / Web Crypto)
// ============================================================================
function runSecretSantaDraw(
  participantIds: number[],
  exclusions: Array<{ giverId: number; excludedReceiverId: number }>,
  avoidReciprocal: boolean
):
  | { success: true; pairs: Array<{ giverId: number; receiverId: number; revealToken: string }> }
  | { success: false; error: string } {
  const uniqueIds = Array.from(new Set(participantIds));
  const n = uniqueIds.length;
  if (n < 3) {
    return {
      success: false,
      error: 'Se necesitan al menos 3 participantes para realizar un sorteo de Amigo Invisible.',
    };
  }

  const strictReciprocal = avoidReciprocal && n >= 3;
  const forbidden = new Map<number, Set<number>>();
  for (const id of uniqueIds) forbidden.set(id, new Set([id]));
  for (const ex of exclusions) {
    const set = forbidden.get(ex.giverId);
    if (set && uniqueIds.includes(ex.excludedReceiverId)) set.add(ex.excludedReceiverId);
  }

  const allowedByGiver = new Map<number, number[]>();
  const incoming = new Map<number, number>();
  for (const id of uniqueIds) incoming.set(id, 0);

  for (const giverId of uniqueIds) {
    const blocked = forbidden.get(giverId)!;
    const candidates = secureShuffle(uniqueIds.filter((c) => !blocked.has(c)));
    if (candidates.length === 0) {
      return {
        success: false,
        error:
          'Hay al menos un participante que no tiene a nadie disponible a quien regalar debido a las exclusiones.',
      };
    }
    allowedByGiver.set(giverId, candidates);
    for (const c of candidates) incoming.set(c, (incoming.get(c) ?? 0) + 1);
  }

  for (const id of uniqueIds) {
    if ((incoming.get(id) ?? 0) === 0) {
      return {
        success: false,
        error: 'Hay al menos un participante excluido por todos los demás; nadie podría regalarle.',
      };
    }
  }

  const assignment = new Map<number, number>();
  const used = new Set<number>();
  const unassigned = new Set<number>(uniqueIds);
  let steps = 0;

  function getValid(giverId: number): number[] {
    const res: number[] = [];
    for (const c of allowedByGiver.get(giverId)!) {
      if (used.has(c)) continue;
      if (strictReciprocal && assignment.get(c) === giverId) continue;
      res.push(c);
    }
    return res;
  }

  function backtrack(): boolean {
    if (unassigned.size === 0) return true;
    if (++steps > 150_000) return false;

    let chosen: number | null = null;
    let chosenCands: number[] = [];
    for (const g of unassigned) {
      const cands = getValid(g);
      if (cands.length === 0) return false;
      if (chosen === null || cands.length < chosenCands.length) {
        chosen = g;
        chosenCands = cands;
        if (cands.length === 1) break;
      }
    }
    if (chosen === null) return false;

    unassigned.delete(chosen);
    for (const r of chosenCands) {
      assignment.set(chosen, r);
      used.add(r);
      if (backtrack()) return true;
      assignment.delete(chosen);
      used.delete(r);
    }
    unassigned.add(chosen);
    return false;
  }

  if (!backtrack()) {
    return {
      success: false,
      error: strictReciprocal
        ? 'No existe ninguna combinación válida con las exclusiones actuales y evitando regalos mutuos.'
        : 'No existe ninguna combinación válida con las exclusiones actuales.',
    };
  }

  return {
    success: true,
    pairs: uniqueIds.map((giverId) => ({
      giverId,
      receiverId: assignment.get(giverId)!,
      revealToken: randomHex(24),
    })),
  };
}

// ============================================================================
// Helper BD: localizar un sorteo por admin_token (privado en producción)
// ============================================================================
async function findDrawByKey(db: D1Database, key: string): Promise<DrawRow | null> {
  const clean = key.trim();
  if (!clean) return null;
  const row = await db
    .prepare('SELECT * FROM draws WHERE admin_token = ? LIMIT 1')
    .bind(clean)
    .first<DrawRow>();
  return row || null;
}

async function sendMetaCloud(env: Env, phone: string, text: string) {
  const token = env.META_WHATSAPP_TOKEN?.trim();
  const phoneId = env.META_PHONE_NUMBER_ID?.trim();
  const version = env.META_API_VERSION?.trim() || 'v21.0';
  if (!token || !phoneId) {
    return {
      ok: false,
      detail: 'Meta Cloud API no configurada en las variables secretas de Cloudflare.',
    };
  }
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhoneDigits(phone),
      type: 'text',
      text: { body: text, preview_url: true },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    return { ok: false, detail: `Meta API (${res.status}): ${data.error?.message || 'Error'}` };
  }
  return { ok: true, detail: `Enviado vía Meta Cloud API (ID: ${data.messages?.[0]?.id || 'ok'})` };
}

// ============================================================================
// Router Principal de Cloudflare Pages Functions (/api/*)
// ============================================================================
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const apiPath = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const parts = apiPath ? apiPath.split('/') : [];

  try {
    // 1. GET /api/health
    if (method === 'GET' && parts[0] === 'health') {
      await env.DB.prepare('SELECT 1').first();
      return json({
        ok: true,
        service: 'amigo-invisible-cloudflare',
        mode: 'cloudflare',
        database: {
          connected: true,
          host: 'cloudflare-d1',
          port: 443,
          name: 'amigo-invisible-db',
          error: null,
        },
      });
    }

    // 2. GET /api/whatsapp/status
    if (method === 'GET' && parts[0] === 'whatsapp' && parts[1] === 'status') {
      return json({
        defaultProvider: 'wame',
        baileysSupported: false,
        baileys: {
          state: 'disconnected',
          qrDataUrl: null,
          phoneNumber: null,
          lastError: null,
        },
        metaCloud: {
          configured: Boolean(env.META_WHATSAPP_TOKEN?.trim() && env.META_PHONE_NUMBER_ID?.trim()),
        },
      });
    }

    // 3. REVEAL: GET /api/reveal/:token y POST /api/reveal/:token/open
    if (parts[0] === 'reveal' && parts[1]) {
      const revealToken = decodeURIComponent(parts[1]).trim();
      if (method === 'GET' && parts.length === 2) {
        const row = await env.DB.prepare(
          `SELECT
            a.id AS assignment_id,
            d.title AS draw_title,
            d.event_date,
            d.budget,
            d.currency,
            g.name AS giver_name,
            r.name AS receiver_name,
            r.wishlist AS receiver_wishlist,
            a.revealed_at
          FROM assignments a
          INNER JOIN draws d ON d.id = a.draw_id
          INNER JOIN participants g ON g.id = a.giver_id
          INNER JOIN participants r ON r.id = a.receiver_id
          WHERE a.reveal_token = ?
          LIMIT 1`
        )
          .bind(revealToken)
          .first<Record<string, unknown>>();

        if (!row) {
          return json(
            {
              error:
                'Este sobre secreto no existe o el sorteo fue reiniciado por el organizador.',
            },
            404
          );
        }

        return json({
          drawTitle: row.draw_title,
          eventDate: row.event_date || null,
          budget: row.budget !== null && row.budget !== undefined ? Number(row.budget) : null,
          currency: row.currency || '€',
          giverName: row.giver_name,
          receiverName: row.receiver_name,
          receiverWishlist: row.receiver_wishlist || null,
          alreadyRevealed: Boolean(row.revealed_at),
          revealedAt: row.revealed_at || null,
        });
      }

      if (method === 'POST' && parts[2] === 'open') {
        await env.DB.prepare(
          `UPDATE assignments
           SET revealed_at = COALESCE(revealed_at, datetime('now'))
           WHERE reveal_token = ?`
        )
          .bind(revealToken)
          .run();
        return json({ ok: true });
      }
    }

    // 4. DRAWS: /api/draws...
    if (parts[0] === 'draws') {
      // GET /api/draws?tokens=tok1,tok2 (solo devuelve los sorteos del propio organizador)
      if (method === 'GET' && parts.length === 1) {
        const rawTokens = url.searchParams.get('tokens') || '';
        const tokens = rawTokens
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length >= 16)
          .slice(0, 30);

        if (tokens.length === 0) {
          return json({ draws: [] });
        }

        const placeholders = tokens.map(() => '?').join(', ');
        const res = await env.DB.prepare(
          `SELECT
            d.*,
            (SELECT COUNT(*) FROM participants p WHERE p.draw_id = d.id) AS participant_count,
            (SELECT COUNT(*) FROM assignments a WHERE a.draw_id = d.id AND a.whatsapp_status = 'sent') AS sent_count,
            (SELECT COUNT(*) FROM assignments a WHERE a.draw_id = d.id AND a.revealed_at IS NOT NULL) AS revealed_count
          FROM draws d
          WHERE d.admin_token IN (${placeholders})
          ORDER BY d.created_at DESC`
        )
          .bind(...tokens)
          .all<DrawRow>();

        return json({ draws: (res.results || []).map(mapDraw) });
      }

      // POST /api/draws
      if (method === 'POST' && parts.length === 1) {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (title.length < 2 || title.length > 150) {
          return json({ error: 'El título debe tener entre 2 y 150 caracteres.' }, 400);
        }

        const adminToken = randomHex(18);
        const eventDate =
          typeof body.event_date === 'string' && body.event_date.trim()
            ? body.event_date.trim()
            : null;
        const budgetRaw = body.budget;
        const budget =
          budgetRaw !== null && budgetRaw !== undefined && budgetRaw !== ''
            ? Number(budgetRaw)
            : null;
        const currency =
          typeof body.currency === 'string' && body.currency.trim()
            ? body.currency.trim().slice(0, 10)
            : '€';
        const customMessage =
          typeof body.custom_message === 'string' && body.custom_message.trim()
            ? body.custom_message.trim().slice(0, 1500)
            : null;
        const avoidReciprocal = body.avoid_reciprocal === false ? 0 : 1;
        const antiSpoiler = body.anti_spoiler === false ? 0 : 1;

        const inserted = await env.DB.prepare(
          `INSERT INTO draws (admin_token, title, event_date, budget, currency, custom_message, avoid_reciprocal, anti_spoiler)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            adminToken,
            title,
            eventDate,
            Number.isFinite(budget) ? budget : null,
            currency,
            customMessage,
            avoidReciprocal,
            antiSpoiler
          )
          .run();

        const row = await env.DB.prepare('SELECT * FROM draws WHERE id = ?')
          .bind(inserted.meta.last_row_id)
          .first<DrawRow>();

        return json({ draw: mapDraw(row!) }, 201);
      }

      // Rutas que operan sobre un sorteo concreto: /api/draws/:key/...
      const drawKey = parts[1] ? decodeURIComponent(parts[1]) : '';
      const drawRow = await findDrawByKey(env.DB, drawKey);
      if (!drawRow) {
        return json({ error: 'Sorteo no encontrado o enlace de organizador inválido.' }, 404);
      }
      const draw = mapDraw(drawRow);
      const drawId = draw.id;

      // GET /api/draws/:key
      if (method === 'GET' && parts.length === 2) {
        const baseUrl = (url.searchParams.get('publicBaseUrl') || url.origin).replace(/\/+$/, '');

        const pRes = await env.DB.prepare(
          'SELECT * FROM participants WHERE draw_id = ? ORDER BY id ASC'
        )
          .bind(drawId)
          .all();

        const eRes = await env.DB.prepare(
          `SELECT
            e.id, e.draw_id, e.giver_id, e.excluded_receiver_id,
            g.name AS giver_name, r.name AS excluded_receiver_name
          FROM exclusions e
          INNER JOIN participants g ON g.id = e.giver_id
          INNER JOIN participants r ON r.id = e.excluded_receiver_id
          WHERE e.draw_id = ?
          ORDER BY e.id ASC`
        )
          .bind(drawId)
          .all();

        const aRes = await env.DB.prepare(
          `SELECT
            a.id, a.draw_id, a.giver_id, a.receiver_id, a.reveal_token,
            a.whatsapp_status, a.sent_at, a.revealed_at,
            g.name AS giver_name, g.phone AS giver_phone,
            r.name AS receiver_name, r.wishlist AS receiver_wishlist
          FROM assignments a
          INNER JOIN participants g ON g.id = a.giver_id
          INNER JOIN participants r ON r.id = a.receiver_id
          WHERE a.draw_id = ?
          ORDER BY g.name ASC`
        )
          .bind(drawId)
          .all<Record<string, unknown>>();

        const assignments = (aRes.results || []).map((row) => {
          const revealUrl = `${baseUrl}/revelar/${row.reveal_token}`;
          const text = buildSecretSantaMessage({
            giverName: String(row.giver_name),
            receiverName: String(row.receiver_name),
            receiverWishlist: (row.receiver_wishlist as string | null) || null,
            drawTitle: draw.title,
            eventDate: draw.event_date,
            budget: draw.budget,
            currency: draw.currency,
            revealUrl,
            customTemplate: draw.custom_message,
            contentMode: 'secret_link',
          });

          const item: Record<string, unknown> = {
            id: row.id,
            draw_id: row.draw_id,
            giver_id: row.giver_id,
            giver_name: row.giver_name,
            giver_phone: row.giver_phone,
            reveal_token: row.reveal_token,
            reveal_url: revealUrl,
            wame_url: buildWaMeUrl(String(row.giver_phone), text),
            whatsapp_status: row.whatsapp_status,
            sent_at: row.sent_at || null,
            revealed_at: row.revealed_at || null,
          };
          if (!draw.anti_spoiler) item.receiver_name = row.receiver_name;
          return item;
        });

        const lRes = await env.DB.prepare(
          `SELECT
            l.id, l.assignment_id, g.name AS giver_name,
            l.provider, l.status, l.message_preview, l.detail, l.created_at
          FROM notification_logs l
          INNER JOIN assignments a ON a.id = l.assignment_id
          INNER JOIN participants g ON g.id = a.giver_id
          WHERE a.draw_id = ?
          ORDER BY l.created_at DESC
          LIMIT 50`
        )
          .bind(drawId)
          .all();

        return json({
          draw,
          participants: pRes.results || [],
          exclusions: eRes.results || [],
          assignments,
          logs: lRes.results || [],
        });
      }

      // PATCH /api/draws/:key
      if (method === 'PATCH' && parts.length === 2) {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const fields: string[] = [];
        const vals: unknown[] = [];

        if (typeof body.title === 'string' && body.title.trim().length >= 2) {
          fields.push('title = ?');
          vals.push(body.title.trim().slice(0, 150));
        }
        if (body.event_date !== undefined) {
          fields.push('event_date = ?');
          vals.push(
            typeof body.event_date === 'string' && body.event_date.trim()
              ? body.event_date.trim()
              : null
          );
        }
        if (body.budget !== undefined) {
          fields.push('budget = ?');
          vals.push(
            body.budget !== null && body.budget !== '' && Number.isFinite(Number(body.budget))
              ? Number(body.budget)
              : null
          );
        }
        if (typeof body.currency === 'string' && body.currency.trim()) {
          fields.push('currency = ?');
          vals.push(body.currency.trim().slice(0, 10));
        }
        if (body.custom_message !== undefined) {
          fields.push('custom_message = ?');
          vals.push(
            typeof body.custom_message === 'string' && body.custom_message.trim()
              ? body.custom_message.trim().slice(0, 1500)
              : null
          );
        }
        if (typeof body.avoid_reciprocal === 'boolean') {
          fields.push('avoid_reciprocal = ?');
          vals.push(body.avoid_reciprocal ? 1 : 0);
        }
        if (typeof body.anti_spoiler === 'boolean') {
          fields.push('anti_spoiler = ?');
          vals.push(body.anti_spoiler ? 1 : 0);
        }

        if (fields.length === 0) return json({ error: 'No hay cambios para guardar.' }, 400);

        fields.push("updated_at = datetime('now')");
        vals.push(drawId);
        await env.DB.prepare(`UPDATE draws SET ${fields.join(', ')} WHERE id = ?`)
          .bind(...vals)
          .run();

        const updated = await env.DB.prepare('SELECT * FROM draws WHERE id = ?')
          .bind(drawId)
          .first<DrawRow>();
        return json({ draw: mapDraw(updated!) });
      }

      // DELETE /api/draws/:key
      if (method === 'DELETE' && parts.length === 2) {
        await env.DB.batch([
          env.DB.prepare(
            'DELETE FROM notification_logs WHERE assignment_id IN (SELECT id FROM assignments WHERE draw_id = ?)'
          ).bind(drawId),
          env.DB.prepare('DELETE FROM assignments WHERE draw_id = ?').bind(drawId),
          env.DB.prepare('DELETE FROM exclusions WHERE draw_id = ?').bind(drawId),
          env.DB.prepare('DELETE FROM participants WHERE draw_id = ?').bind(drawId),
          env.DB.prepare('DELETE FROM draws WHERE id = ?').bind(drawId),
        ]);
        return json({ ok: true });
      }

      // PARTICIPANTS: /api/draws/:key/participants(/:pid)
      if (parts[2] === 'participants') {
        if (method === 'POST' && parts.length === 3) {
          if (draw.status !== 'draft') {
            return json(
              {
                error:
                  'El sorteo ya se ha realizado. Reinícialo si necesitas añadir más participantes.',
              },
              409
            );
          }
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const name = typeof body.name === 'string' ? body.name.trim() : '';
          const phone =
            typeof body.phone === 'string' ? body.phone.replace(/\s+/g, ' ').trim() : '';
          const wishlist =
            typeof body.wishlist === 'string' && body.wishlist.trim()
              ? body.wishlist.trim().slice(0, 1000)
              : null;

          if (!name) return json({ error: 'El nombre es obligatorio.' }, 400);
          if (phone.length < 6) {
            return json(
              { error: 'Introduce un teléfono válido con prefijo (ej: +34 600 111 222).' },
              400
            );
          }

          try {
            const ins = await env.DB.prepare(
              'INSERT INTO participants (draw_id, name, phone, wishlist) VALUES (?, ?, ?, ?)'
            )
              .bind(drawId, name.slice(0, 120), phone.slice(0, 30), wishlist)
              .run();
            const row = await env.DB.prepare('SELECT * FROM participants WHERE id = ?')
              .bind(ins.meta.last_row_id)
              .first();
            return json({ participant: row }, 201);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '';
            if (msg.includes('UNIQUE')) {
              return json(
                { error: 'Ya existe un participante con ese número de teléfono en este sorteo.' },
                409
              );
            }
            throw e;
          }
        }

        const pid = Number(parts[3]);
        if (method === 'PATCH' && Number.isInteger(pid) && pid > 0) {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const fields: string[] = [];
          const vals: unknown[] = [];

          if (typeof body.name === 'string' && body.name.trim()) {
            fields.push('name = ?');
            vals.push(body.name.trim().slice(0, 120));
          }
          if (typeof body.phone === 'string' && body.phone.trim().length >= 6) {
            fields.push('phone = ?');
            vals.push(body.phone.replace(/\s+/g, ' ').trim().slice(0, 30));
          }
          if (body.wishlist !== undefined) {
            fields.push('wishlist = ?');
            vals.push(
              typeof body.wishlist === 'string' && body.wishlist.trim()
                ? body.wishlist.trim().slice(0, 1000)
                : null
            );
          }
          if (fields.length === 0) return json({ error: 'No hay cambios para guardar.' }, 400);

          vals.push(pid, drawId);
          try {
            await env.DB.prepare(
              `UPDATE participants SET ${fields.join(', ')} WHERE id = ? AND draw_id = ?`
            )
              .bind(...vals)
              .run();
            const row = await env.DB.prepare(
              'SELECT * FROM participants WHERE id = ? AND draw_id = ?'
            )
              .bind(pid, drawId)
              .first();
            if (!row) return json({ error: 'Participante no encontrado.' }, 404);
            return json({ participant: row });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '';
            if (msg.includes('UNIQUE')) {
              return json(
                { error: 'Ese número de teléfono ya está asignado a otro participante.' },
                409
              );
            }
            throw e;
          }
        }

        if (method === 'DELETE' && Number.isInteger(pid) && pid > 0) {
          if (draw.status !== 'draft') {
            return json({ error: 'Reinicia el sorteo antes de eliminar participantes.' }, 409);
          }
          await env.DB.batch([
            env.DB.prepare(
              'DELETE FROM exclusions WHERE draw_id = ? AND (giver_id = ? OR excluded_receiver_id = ?)'
            ).bind(drawId, pid, pid),
            env.DB.prepare('DELETE FROM participants WHERE id = ? AND draw_id = ?').bind(
              pid,
              drawId
            ),
          ]);
          return json({ ok: true });
        }
      }

      // EXCLUSIONS: /api/draws/:key/exclusions(/:eid)
      if (parts[2] === 'exclusions') {
        if (method === 'POST' && parts.length === 3) {
          if (draw.status !== 'draft') {
            return json({ error: 'Reinicia el sorteo para modificar exclusiones.' }, 409);
          }
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const giverId = Number(body.giver_id);
          const receiverId = Number(body.excluded_receiver_id);
          const bidirectional = Boolean(body.bidirectional);

          if (!Number.isInteger(giverId) || !Number.isInteger(receiverId) || giverId === receiverId) {
            return json({ error: 'Datos de exclusión inválidos.' }, 400);
          }

          const stmts = [
            env.DB.prepare(
              'INSERT OR IGNORE INTO exclusions (draw_id, giver_id, excluded_receiver_id) VALUES (?, ?, ?)'
            ).bind(drawId, giverId, receiverId),
          ];
          if (bidirectional) {
            stmts.push(
              env.DB.prepare(
                'INSERT OR IGNORE INTO exclusions (draw_id, giver_id, excluded_receiver_id) VALUES (?, ?, ?)'
              ).bind(drawId, receiverId, giverId)
            );
          }
          await env.DB.batch(stmts);
          return json({ ok: true }, 201);
        }

        const eid = Number(parts[3]);
        if (method === 'DELETE' && Number.isInteger(eid) && eid > 0) {
          await env.DB.prepare('DELETE FROM exclusions WHERE id = ? AND draw_id = ?')
            .bind(eid, drawId)
            .run();
          return json({ ok: true });
        }
      }

      // POST /api/draws/:key/run
      if (method === 'POST' && parts[2] === 'run') {
        const pRes = await env.DB.prepare('SELECT id FROM participants WHERE draw_id = ?')
          .bind(drawId)
          .all<{ id: number }>();
        const eRes = await env.DB.prepare(
          'SELECT giver_id, excluded_receiver_id FROM exclusions WHERE draw_id = ?'
        )
          .bind(drawId)
          .all<{ giver_id: number; excluded_receiver_id: number }>();

        const alg = runSecretSantaDraw(
          (pRes.results || []).map((p) => Number(p.id)),
          (eRes.results || []).map((e) => ({
            giverId: Number(e.giver_id),
            excludedReceiverId: Number(e.excluded_receiver_id),
          })),
          draw.avoid_reciprocal
        );

        if (!alg.success) {
          return json({ error: alg.error }, 422);
        }

        const stmts: D1PreparedStatement[] = [
          env.DB.prepare(
            'DELETE FROM notification_logs WHERE assignment_id IN (SELECT id FROM assignments WHERE draw_id = ?)'
          ).bind(drawId),
          env.DB.prepare('DELETE FROM assignments WHERE draw_id = ?').bind(drawId),
          ...alg.pairs.map((pair) =>
            env.DB.prepare(
              `INSERT INTO assignments (draw_id, giver_id, receiver_id, reveal_token, whatsapp_status)
               VALUES (?, ?, ?, ?, 'pending')`
            ).bind(drawId, pair.giverId, pair.receiverId, pair.revealToken)
          ),
          env.DB.prepare("UPDATE draws SET status = 'drawn', updated_at = datetime('now') WHERE id = ?").bind(
            drawId
          ),
        ];

        await env.DB.batch(stmts);
        return json({ ok: true, count: alg.pairs.length });
      }

      // POST /api/draws/:key/reset
      if (method === 'POST' && parts[2] === 'reset') {
        await env.DB.batch([
          env.DB.prepare(
            'DELETE FROM notification_logs WHERE assignment_id IN (SELECT id FROM assignments WHERE draw_id = ?)'
          ).bind(drawId),
          env.DB.prepare('DELETE FROM assignments WHERE draw_id = ?').bind(drawId),
          env.DB.prepare("UPDATE draws SET status = 'draft', updated_at = datetime('now') WHERE id = ?").bind(
            drawId
          ),
        ]);
        return json({ ok: true });
      }

      // Helper para procesar un envío individual en Cloudflare D1
      const processOne = async (
        row: Record<string, unknown>,
        provider: WhatsAppProviderType,
        contentMode: MessageContentMode,
        baseUrl: string
      ) => {
        const revealUrl = `${baseUrl}/revelar/${row.reveal_token}`;
        const text = buildSecretSantaMessage({
          giverName: String(row.giver_name),
          receiverName: String(row.receiver_name),
          receiverWishlist: (row.receiver_wishlist as string | null) || null,
          drawTitle: draw.title,
          eventDate: draw.event_date,
          budget: draw.budget,
          currency: draw.currency,
          revealUrl,
          customTemplate: draw.custom_message,
          contentMode,
        });
        const preview = draw.anti_spoiler
          ? `[Modo Anti-Spoiler activo] Mensaje preparado para ${row.giver_name} (${contentMode})`
          : text;

        let ok = true;
        let logStatus: 'sent' | 'failed' | 'simulated' = 'sent';
        let detail = '';
        let wameUrl: string | undefined;

        if (provider === 'wame') {
          wameUrl = buildWaMeUrl(String(row.giver_phone), text);
          detail = 'Enlace wa.me generado correctamente para envío en 1 clic.';
        } else if (provider === 'simulator') {
          logStatus = 'simulated';
          detail = `Simulación exitosa para ${row.giver_phone}.`;
        } else if (provider === 'meta_cloud') {
          const metaRes = await sendMetaCloud(env, String(row.giver_phone), text);
          ok = metaRes.ok;
          logStatus = metaRes.ok ? 'sent' : 'failed';
          detail = metaRes.detail;
        } else {
          ok = false;
          logStatus = 'failed';
          detail = 'El modo WhatsApp QR solo está disponible en ejecución local.';
        }

        const newStatus = ok ? 'sent' : 'failed';
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE assignments
             SET whatsapp_status = ?,
                 sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END
             WHERE id = ?`
          ).bind(newStatus, newStatus, row.id),
          env.DB.prepare(
            `INSERT INTO notification_logs (assignment_id, provider, status, message_preview, detail)
             VALUES (?, ?, ?, ?, ?)`
          ).bind(row.id, provider, logStatus, preview, detail),
        ]);

        return { ok, provider, status: logStatus, detail, wameUrl };
      };

      // POST /api/draws/:key/send (masivo)
      if (method === 'POST' && parts[2] === 'send') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const provider = (body.provider || 'wame') as WhatsAppProviderType;
        const contentMode = (body.contentMode || 'secret_link') as MessageContentMode;
        const forceResend = Boolean(body.forceResend);
        const baseUrl = (
          typeof body.publicBaseUrl === 'string' ? body.publicBaseUrl : url.origin
        ).replace(/\/+$/, '');

        if (provider === 'wame') {
          return json(
            { error: 'El modo wa.me se envía individualmente pulsando el botón de cada participante.' },
            400
          );
        }

        const filter = forceResend ? '' : "AND a.whatsapp_status <> 'sent'";
        const aRes = await env.DB.prepare(
          `SELECT
            a.id, a.reveal_token, g.name AS giver_name, g.phone AS giver_phone,
            r.name AS receiver_name, r.wishlist AS receiver_wishlist
          FROM assignments a
          INNER JOIN participants g ON g.id = a.giver_id
          INNER JOIN participants r ON r.id = a.receiver_id
          WHERE a.draw_id = ? ${filter}
          ORDER BY a.id ASC`
        )
          .bind(drawId)
          .all<Record<string, unknown>>();

        const rows = aRes.results || [];
        if (rows.length === 0) {
          return json({ ok: true, sent: 0, failed: 0, message: 'No hay mensajes pendientes.' });
        }

        let sent = 0;
        let failed = 0;
        for (const row of rows) {
          const r = await processOne(row, provider, contentMode, baseUrl);
          if (r.ok) sent++;
          else failed++;
        }

        const pending = await env.DB.prepare(
          "SELECT COUNT(*) AS cnt FROM assignments WHERE draw_id = ? AND whatsapp_status <> 'sent'"
        )
          .bind(drawId)
          .first<{ cnt: number }>();
        if (Number(pending?.cnt ?? 1) === 0) {
          await env.DB.prepare("UPDATE draws SET status = 'sent' WHERE id = ?").bind(drawId).run();
        }

        return json({ ok: failed === 0, sent, failed });
      }

      // POST /api/draws/:key/assignments/:aid/send (individual)
      if (method === 'POST' && parts[2] === 'assignments' && parts[4] === 'send') {
        const aid = Number(parts[3]);
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const provider = (body.provider || 'wame') as WhatsAppProviderType;
        const contentMode = (body.contentMode || 'secret_link') as MessageContentMode;
        const baseUrl = (
          typeof body.publicBaseUrl === 'string' ? body.publicBaseUrl : url.origin
        ).replace(/\/+$/, '');

        const row = await env.DB.prepare(
          `SELECT
            a.id, a.reveal_token, g.name AS giver_name, g.phone AS giver_phone,
            r.name AS receiver_name, r.wishlist AS receiver_wishlist
          FROM assignments a
          INNER JOIN participants g ON g.id = a.giver_id
          INNER JOIN participants r ON r.id = a.receiver_id
          WHERE a.draw_id = ? AND a.id = ?
          LIMIT 1`
        )
          .bind(drawId, aid)
          .first<Record<string, unknown>>();

        if (!row) return json({ error: 'Asignación no encontrada.' }, 404);

        const result = await processOne(row, provider, contentMode, baseUrl);

        const pending = await env.DB.prepare(
          "SELECT COUNT(*) AS cnt FROM assignments WHERE draw_id = ? AND whatsapp_status <> 'sent'"
        )
          .bind(drawId)
          .first<{ cnt: number }>();
        if (Number(pending?.cnt ?? 1) === 0) {
          await env.DB.prepare("UPDATE draws SET status = 'sent' WHERE id = ?").bind(drawId).run();
        }

        return json({ ok: result.ok, result });
      }
    }

    return json({ error: 'Ruta API no encontrada.' }, 404);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno del servidor';
    return json({ error: msg }, 500);
  }
};
