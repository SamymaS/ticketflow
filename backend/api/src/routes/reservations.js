import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { holdSeats, heldBy, releaseSeats } from '../holds.js';
import { pay } from '../payment.js';
import { publish } from '../queue.js';
import { EVENTS } from '../events.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export const reservations = Router();
const seatBody = z.object({ eventId: z.string().uuid(), seatIds: z.array(z.string().uuid()).min(1) });

// 1) Poser un verrou temporaire sur des sièges (Redis TTL).
reservations.post('/hold', requireAuth, async (req, res, next) => {
  try {
    const { eventId, seatIds } = seatBody.parse(req.body);
    const acquired = await holdSeats(eventId, seatIds, req.userId);
    if (!acquired) return res.status(409).json({ error: 'Un ou plusieurs sièges sont déjà pris' });
    res.json({ held: acquired, expiresInSeconds: config.holdTtlSeconds });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// 2) Checkout : vérifie le hold, appelle le paiement (circuit breaker), confirme, publie l'évènement.
reservations.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { eventId, seatIds } = seatBody.parse(req.body);

    for (const seatId of seatIds) {
      if ((await heldBy(eventId, seatId)) !== req.userId)
        return res.status(409).json({ error: `Siège ${seatId} non réservé par vous` });
    }

    const seatsRes = await pool.query(
      `SELECT id, price_cents, status FROM seats WHERE event_id = $1 AND id = ANY($2)`,
      [eventId, seatIds]
    );
    if (seatsRes.rows.some((s) => s.status === 'sold'))
      return res.status(409).json({ error: 'Siège déjà vendu' });
    const totalCents = seatsRes.rows.reduce((sum, s) => sum + s.price_cents, 0);

    await client.query('BEGIN');
    const resv = await client.query(
      `INSERT INTO reservations (event_id, user_id, status, total_cents)
       VALUES ($1,$2,'pending',$3) RETURNING id`,
      [eventId, req.userId, totalCents]
    );
    const reservationId = resv.rows[0].id;
    for (const seatId of seatIds)
      await client.query(`INSERT INTO reservation_seats (reservation_id, seat_id) VALUES ($1,$2)`, [reservationId, seatId]);
    await client.query('COMMIT');

    // Appel externe protégé par le circuit breaker.
    const result = await pay({ reservationId, amountCents: totalCents });
    if (!result.ok) {
      await pool.query(`UPDATE reservations SET status='payment_failed' WHERE id=$1`, [reservationId]);
      const code = result.degraded ? 503 : 402;
      return res.status(code).json({ error: 'Paiement refusé ou indisponible', reservationId, degraded: !!result.degraded });
    }

    await client.query('BEGIN');
    await client.query(`UPDATE reservations SET status='paid', paid_at=now() WHERE id=$1`, [reservationId]);
    await client.query(`UPDATE seats SET status='sold' WHERE id = ANY($1)`, [seatIds]);
    await client.query(
      `INSERT INTO payments (reservation_id, status, provider_ref, amount_cents) VALUES ($1,'succeeded',$2,$3)`,
      [reservationId, result.providerRef ?? null, totalCents]
    );
    await client.query('COMMIT');
    await releaseSeats(eventId, seatIds);

    await publish(EVENTS.RESERVATION_PAID, { reservationId, userId: req.userId });
    res.status(201).json({ reservationId, status: 'paid' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    logger.error({ err }, 'échec checkout');
    next(err);
  } finally {
    client.release();
  }
});

reservations.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.status, r.total_cents, r.created_at, e.title AS event_title,
              COALESCE(json_agg(json_build_object('seatId', t.seat_id, 'pdfUrl', t.pdf_url))
                       FILTER (WHERE t.id IS NOT NULL), '[]') AS tickets
       FROM reservations r
       JOIN events e ON e.id = r.event_id
       LEFT JOIN tickets t ON t.reservation_id = r.id
       WHERE r.user_id = $1
       GROUP BY r.id, e.title ORDER BY r.created_at DESC`,
      [req.userId]
    );
    res.json({ reservations: rows });
  } catch (err) { next(err); }
});
