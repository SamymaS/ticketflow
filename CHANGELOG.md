# Changelog — Correctifs et améliorations (23 juin 2026)

Ce document résume les modifications apportées lors de la session de correction du flux de génération de billets (PDF, QR code) et de l'interface utilisateur.

---

## 1. Accès public aux PDFs — MinIO bucket policy

**Fichier :** `backend/worker/src/storage.js`

**Problème :** Le bucket MinIO était créé sans politique d'accès. Les URLs de PDF générées (`http://localhost:9000/tickets/...pdf`) retournaient une erreur **403 Access Denied** dans le navigateur.

**Correction :** Ajout de `PutBucketPolicyCommand` dans `ensureBucket()` pour rendre les objets du bucket lisibles publiquement. La politique est appliquée à chaque démarrage du worker (idempotent).

---

## 2. Message d'erreur de connexion généraliste

**Fichier :** `frontend/src/pages/LoginPage.jsx`

**Problème :** En cas de mauvais identifiants, l'interface affichait le message brut renvoyé par le serveur (ex. `HTTP 401`).

**Correction :** Détection du code HTTP dans le `catch` :
- Erreur 401 → *"Identifiants incorrects. Vérifiez votre email et mot de passe."*
- Autre erreur → *"Une erreur est survenue. Veuillez réessayer."*

---

## 3. Requête API `/mine` enrichie

**Fichier :** `backend/api/src/routes/reservations.js`

**Problème :** La route `GET /api/reservations/mine` ne retournait que l'UUID du siège (`seatId`) et l'URL du PDF. Aucune information lisible sur le siège ni le texte du QR code n'était disponible côté frontend.

**Correction :** La requête SQL joint désormais la table `seats` pour retourner par billet :

| Champ | Description |
|---|---|
| `seatId` | UUID du siège |
| `pdfUrl` | URL du PDF dans MinIO |
| `qrCode` | Contenu textuel du QR code |
| `section` | Section (ex. Orchestre) |
| `rowLabel` | Rangée (ex. A) |
| `number` | Numéro de siège |

---

## 4. PDF redessiné — reçu complet

**Fichier :** `backend/worker/src/handlers/reservationPaid.js`

**Problème :** Le PDF généré était minimaliste : titre, lieu, place (UUID) et QR code.

**Correction :** Le PDF est restructuré en reçu complet :

```
┌─────────────────────────────────┐
│  TicketFlow          [en-tête violet]
├─────────────────────────────────┤
│  BILLET D'ENTRÉE                │
│  [Titre de l'événement]         │
│  [Lieu]                         │
│  [Date et heure complètes]      │
├─────────────────────────────────┤
│  VOTRE PLACE                    │
│  Section :  Orchestre           │
│  Rangée :   A                   │
│  Siège N° : 3                   │
│  Prix :     50.00 €             │
├─────────────────────────────────┤
│         [QR CODE]               │
│  Présentez ce QR à l'entrée     │
├─────────────────────────────────┤
│  Réf. réservation : 622C1B1F    │
│  Généré le 23/06/2026           │
└─────────────────────────────────┘
```

La requête SQL du worker est également enrichie pour récupérer `starts_at` et `price_cents`.

---

## 5. Page "Mes billets" — label de siège lisible

**Fichier :** `frontend/src/pages/MyTicketsPage.jsx`

**Problème :** Chaque billet affichait `Siège #<UUID>`, un identifiant technique illisible.

**Correction :** Le label affiché utilise désormais les informations de siège retournées par l'API :

> **Orchestre — Rangée A, Siège 3**

---

## 6. Page "Mes billets" — deux boutons par billet

**Fichier :** `frontend/src/pages/MyTicketsPage.jsx`

**Problème :** Un seul bouton "Télécharger PDF" était affiché par billet (ce qui donnait l'impression d'une duplication quand plusieurs sièges étaient réservés).

**Correction :** Chaque billet affiche désormais deux actions :

- **Télécharger PDF** — ouvre le PDF dans un nouvel onglet
- **Voir QR code** — ouvre une modale avec le QR code scannable

---

## 7. Modale QR code

**Fichiers :** `frontend/src/pages/MyTicketsPage.jsx`, `frontend/src/index.css`

**Ajout :** Un clic sur "Voir QR code" ouvre une popup centrée contenant :
- Le label du siège
- L'image QR code générée côté navigateur
- La mention *"Présentez ce QR code à l'entrée"*
- Un bouton de fermeture (ou clic en dehors de la modale)

Le QR code est généré côté client à partir du texte `ticketflow:{reservationId}:{seatId}` via le package `qrcode`.

**Dépendance ajoutée :** `qrcode ^1.5.4` dans `frontend/package.json`.

---

## Fichiers modifiés

| Fichier | Type de modification |
|---|---|
| `backend/worker/src/storage.js` | Politique publique bucket MinIO |
| `backend/worker/src/handlers/reservationPaid.js` | Requête enrichie + PDF redessiné |
| `backend/api/src/routes/reservations.js` | Requête `/mine` enrichie |
| `frontend/src/pages/LoginPage.jsx` | Message d'erreur connexion |
| `frontend/src/pages/MyTicketsPage.jsx` | Label siège, boutons PDF/QR, modale |
| `frontend/src/index.css` | Styles modale QR code |
| `frontend/package.json` | Ajout dépendance `qrcode` |

---

## Notes

- Les tickets déjà générés conservent l'ancien format PDF. Pour regénérer, supprimer les entrées correspondantes dans la table `tickets` et republier l'événement `RESERVATION_PAID`.
- Le package `qrcode` doit être installé avant de relancer le frontend : `cd frontend && npm install`.
