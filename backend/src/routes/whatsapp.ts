import { Router } from 'express';
import { baileysManager, getMetaCloudConfigStatus } from '../services/whatsappService.js';

export const whatsappRouter = Router();

whatsappRouter.get('/status', (_req, res) => {
  res.json({
    defaultProvider: process.env.WHATSAPP_DEFAULT_PROVIDER || 'simulator',
    baileysSupported: true,
    baileys: baileysManager.getStatus(),
    metaCloud: getMetaCloudConfigStatus(),
  });
});

whatsappRouter.post('/baileys/connect', async (_req, res) => {
  const status = await baileysManager.connect();
  res.json({ baileys: status });
});

whatsappRouter.post('/baileys/logout', async (_req, res) => {
  const status = await baileysManager.logout();
  res.json({ baileys: status });
});

whatsappRouter.post('/baileys/test', async (req, res) => {
  const status = baileysManager.getStatus();
  if (status.state !== 'connected') {
    res.status(409).json({
      ok: false,
      error: 'WhatsApp QR no está conectado todavía. Escanea el código QR primero.',
    });
    return;
  }

  const targetPhone =
    typeof req.body?.phone === 'string' && req.body.phone.trim().length > 0
      ? req.body.phone.trim()
      : status.phoneNumber || '';

  if (!targetPhone) {
    res.status(400).json({ ok: false, error: 'Indica un número de teléfono válido.' });
    return;
  }

  const text =
    typeof req.body?.message === 'string' && req.body.message.trim().length > 0
      ? req.body.message.trim()
      : '🎄 *¡Prueba de Amigo Invisible completada!* 🎅\n\nSi recibes este WhatsApp, tu app en local ya está conectada y lista para enviar los sorteos de Navidad automáticamente. ✨🎁';

  const result = await baileysManager.sendText(targetPhone, text);
  if (!result.ok) {
    res.status(500).json({ ok: false, error: result.detail });
    return;
  }
  res.json({ ok: true, phone: targetPhone, detail: result.detail });
});

