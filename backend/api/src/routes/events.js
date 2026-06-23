import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { heldBy } from '../holds.js';

export const events = Router();

events.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.description, e.venue, e.starts_at, e.image_url,
              MIN(s.price_cents) AS min_price_cents,
              MAX(s.price_cents) AS max_price_cents,
              COUNT(s.id) FILTER (WHERE s.status = 'available') AS available_seats,
              COUNT(s.id) AS total_seats
       FROM events e
       LEFT JOIN seats s ON s.event_id = e.id
       GROUP BY e.id
       ORDER BY e.starts_at`
    );
    res.json({ events: rows });
  } catch (err) { next(err); }
});

// Détail + plan de salle : chaque siège a un statut available / held / sold.
events.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const ev = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (!ev.rows[0]) return res.status(404).json({ error: 'Événement introuvable' });
    const seatsRes = await pool.query(
      `SELECT id, section, row_label, number, price_cents, status
       FROM seats WHERE event_id = $1 ORDER BY section, row_label, number`,
      [req.params.id]
    );
    const seats = [];
    for (const s of seatsRes.rows) {
      let status = s.status; // available | sold
      if (status === 'available' && (await heldBy(req.params.id, s.id))) status = 'held';
      seats.push({ ...s, status });
    }
    res.json({ event: ev.rows[0], seats });
  } catch (err) { next(err); }
});
