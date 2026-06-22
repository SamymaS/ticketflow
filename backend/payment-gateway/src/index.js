import express from 'express';

// Passerelle de paiement MOCKÉE : dépendance externe que le circuit breaker de l'API protège.
// Pilotable via variables d'env pour la démo :
//   FAILURE_RATE=0.0..1.0  (proba d'échec)   LATENCY_MS=...  (latence simulée)
const PORT = Number(process.env.PORT ?? 4200);
const FAILURE_RATE = Number(process.env.FAILURE_RATE ?? 0);
const LATENCY_MS = Number(process.env.LATENCY_MS ?? 50);

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

app.post('/charge', async (req, res) => {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  if (Math.random() < FAILURE_RATE) {
    return res.status(502).json({ ok: false, error: 'gateway error (simulé)' });
  }
  const { reservationId, amountCents } = req.body ?? {};
  res.json({ ok: true, providerRef: `pay_${Date.now()}`, reservationId, amountCents });
});

app.listen(PORT, () => console.log(JSON.stringify({ msg: 'payment-gateway (mock) up', port: PORT, FAILURE_RATE, LATENCY_MS })));
