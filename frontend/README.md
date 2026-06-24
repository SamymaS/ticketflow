# frontend

Application React consommant l'API TicketFlow.

## Pages MVP
1. **Auth** — register / login (stocke le token JWT).
2. **Événements** — liste (`GET /api/events`).
3. **Détail + plan de salle** — grille de sièges colorés par statut (`available` / `held` / `sold`).
4. **Sélection** — sièges choisis -> `POST /api/reservations/hold` -> minuteur (`expiresInSeconds`).
5. **Checkout** — `POST /api/reservations` -> succès, ou message « paiement indisponible » si `503`.
6. **Mes billets** — `GET /api/reservations/mine` + liens de téléchargement PDF.

Contrat d'API détaillé : `../docs/api-contract.md`.
URL de l'API via `REACT_APP_API_URL` (voir `.env.example`).

## Build conteneurisé
Le `Dockerfile` construit l'app et la sert via nginx (`nginx.conf`, fallback SPA).
