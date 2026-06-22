import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { hashPassword, verifyPassword, signToken } from '../auth.js';

export const users = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

users.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const hash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, name, email`,
      [name, email, hash]
    );
    const user = rows[0];
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé' });
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

users.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const u = rows[0];
    if (!u || !(await verifyPassword(password, u.password_hash)))
      return res.status(401).json({ error: 'Identifiants invalides' });
    const user = { id: u.id, name: u.name, email: u.email };
    res.json({ user, token: signToken(user) });
  } catch (err) { next(err); }
});
