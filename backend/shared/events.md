# Contrats d'évènements

File BullMQ : `ticketflow-events`.

| Évènement | Émis par | Payload | Traitement worker |
|---|---|---|---|
| `reservation.paid` | API (`POST /api/reservations` après paiement) | `{ reservationId, userId }` | génère QR + billet PDF par siège, upload stockage objet, enregistre les billets, email (stub) |

Fiabilité : `attempts: 5`, backoff exponentiel, échecs conservés (dead-letter). Handler idempotent.
