# ADR 0002 — Passerelle de paiement mockée

## Statut
Accepté

## Contexte
Besoin d'une dépendance externe faillible pour justifier et démontrer le circuit breaker, sans la complexité d'une vraie intégration (clés, webhooks) en 48h.

## Décision
Service `payment-gateway` interne, à taux d'échec et latence configurables par variables d'env.

## Conséquences
On peut déclencher une panne en direct (monter `FAILURE_RATE`) pour montrer le circuit qui s'ouvre — idéal pour la démo. Remplaçable par Stripe plus tard.
