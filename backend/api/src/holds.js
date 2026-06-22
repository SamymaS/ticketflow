import { redis } from './redis.js';
import { config } from './config.js';

const key = (eventId, seatId) => `hold:${eventId}:${seatId}`;

// Verrou temporaire d'un siège : SET ... NX EX = atomique, expire seul (TTL).
// Renvoie la liste des sièges effectivement réservés, ou null si conflit (et libère les pris).
export async function holdSeats(eventId, seatIds, userId) {
  const acquired = [];
  for (const seatId of seatIds) {
    const ok = await redis.set(key(eventId, seatId), userId, 'EX', config.holdTtlSeconds, 'NX');
    if (ok === 'OK') acquired.push(seatId);
    else {
      // conflit : on relâche ce qu'on venait de prendre
      for (const s of acquired) await redis.del(key(eventId, s));
      return null;
    }
  }
  return acquired;
}

export async function heldBy(eventId, seatId) {
  return redis.get(key(eventId, seatId));
}

export async function releaseSeats(eventId, seatIds) {
  for (const seatId of seatIds) await redis.del(key(eventId, seatId));
}
