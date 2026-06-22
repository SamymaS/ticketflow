# Contrat d'API (pour le frontend)

Base URL locale : `http://localhost:4000`. Auth : `Authorization: Bearer <token>`.

## Auth
- `POST /api/users/register` body `{ name, email, password }` -> `{ user, token }`
- `POST /api/users/login` body `{ email, password }` -> `{ user, token }`

## Événements
- `GET /api/events` -> `{ events: [{ id, title, description, venue, starts_at, image_url }] }`
- `GET /api/events/:id` -> `{ event, seats: [{ id, section, row_label, number, price_cents, status }] }`
  - `status` ∈ `available` | `held` | `sold`

## Réservation
- `POST /api/reservations/hold` body `{ eventId, seatIds: [] }`
  -> `{ held: [], expiresInSeconds }` ou `409` si conflit
- `POST /api/reservations` body `{ eventId, seatIds: [] }`
  -> `201 { reservationId, status: "paid" }`
  -> `402` paiement refusé / `503` paiement indisponible (circuit ouvert) `{ degraded: true }`
- `GET /api/reservations/mine`
  -> `{ reservations: [{ id, status, total_cents, event_title, tickets: [{ seatId, pdfUrl }] }] }`

## Flux côté UI
1. Lister les événements -> choisir -> afficher le plan de salle.
2. Sélectionner des sièges -> `POST /hold` -> démarrer un minuteur (`expiresInSeconds`).
3. `POST /reservations` -> succès = aller à « mes billets » ; `503` = afficher « paiement indisponible, réessayez ».
4. « Mes billets » -> liens `pdfUrl`.
