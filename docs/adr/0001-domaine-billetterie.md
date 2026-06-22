# ADR 0001 — Domaine : billetterie avec réservation de sièges

## Statut
Accepté

## Contexte
Le projet doit justifier *naturellement* circuit breaker, broker et concurrence, sous contrainte de 48h.

## Décision
Billetterie : réservation de sièges (verrou Redis TTL), paiement via passerelle externe (circuit breaker),
génération asynchrone des billets (broker + worker + stockage objet).

## Conséquences
Chaque pattern correspond à un vrai besoin métier. Scope MVP strict pour tenir le délai.
