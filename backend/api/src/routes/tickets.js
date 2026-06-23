import { Router } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { pool } from '../db.js';

export const tickets = Router();

const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});
const BUCKET = process.env.S3_BUCKET || 'tickets';

tickets.get('/:reservationId/:seatId/pdf', async (req, res, next) => {
  const { reservationId, seatId } = req.params;
  try {
    const out = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: `${reservationId}/${seatId}.pdf`,
    }));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="billet-${seatId}.pdf"`);
    out.Body.pipe(res);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Billet introuvable ou PDF pas encore genere' });
    }
    next(err);
  }
});

tickets.get('/:reservationId/:seatId/verify', async (req, res, next) => {
  const { reservationId, seatId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT r.status, e.title AS event_title, e.venue, e.starts_at,
              s.section, s.row_label, s.number
       FROM reservations r
       JOIN events e ON e.id = r.event_id
       JOIN reservation_seats rs ON rs.reservation_id = r.id
       JOIN seats s ON s.id = rs.seat_id
       WHERE r.id = $1 AND s.id = $2`,
      [reservationId, seatId]
    );
    const t = rows[0];
    const valid = !!t && t.status === 'paid';

    if (req.accepts(['html', 'json']) === 'json') {
      return res.json({ valid, ...(t || {}) });
    }

    const seat = t ? `${t.section} — Rangee ${t.row_label}, Siege ${t.number}` : '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verification du billet — TicketFlow</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0b0b14;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0}
  .card{background:#16161f;border:1px solid #2a2a3a;border-radius:16px;padding:32px;max-width:360px;text-align:center}
  .ok{color:#34d399;font-size:48px}.ko{color:#f87171;font-size:48px}
  h1{font-size:20px;margin:8px 0}p{color:#aab;margin:4px 0}
</style></head><body><div class="card">
${valid
  ? `<div class="ok">&#10003;</div><h1>Billet valide</h1><p><strong>${t.event_title}</strong></p><p>${t.venue}</p><p>${seat}</p>`
  : `<div class="ko">&#10007;</div><h1>Billet invalide</h1><p>Ce billet n''existe pas ou n''est pas paye.</p>`}
<p style="margin-top:16px;font-size:12px;color:#667">TicketFlow</p>
</div></body></html>`);
  } catch (err) { next(err); }
});
