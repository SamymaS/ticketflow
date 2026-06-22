# shared

Conventions partagées entre `api` (producteur) et `worker` (consommateur).

- File BullMQ : `ticketflow-events`
- Le schéma SQL fait foi dans `backend/api/migrations/`.
- Contrats d'évènements : voir `events.md`.

Les constantes `QUEUE_NAME` / `EVENTS` sont dupliquées dans `api/src/events.js` et
`worker/src/events.js` pour garder des contextes de build Docker indépendants ; `events.md` est la source de vérité.
