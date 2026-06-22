import CircuitBreaker from 'opossum';
import { config } from './config.js';
import { logger } from './logger.js';

// Appel SYNCHRONE vers une dépendance externe (passerelle de paiement) :
// c'est exactement le cas où circuit breaker + timeout + fallback sont justifiés.
async function charge({ reservationId, amountCents }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.payment.timeoutMs);
  try {
    const res = await fetch(`${config.payment.url}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId, amountCents }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`gateway status ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

const breaker = new CircuitBreaker(charge, {
  timeout: config.payment.timeoutMs + 500,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
});

breaker.fallback(() => {
  logger.warn('paiement indisponible (circuit ouvert) — réservation laissée en attente');
  return { ok: false, degraded: true };
});

breaker.on('open', () => logger.error('circuit paiement OUVERT'));
breaker.on('halfOpen', () => logger.info('circuit paiement en test (half-open)'));
breaker.on('close', () => logger.info('circuit paiement refermé'));

export const pay = (payload) => breaker.fire(payload);
