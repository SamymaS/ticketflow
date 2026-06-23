# Guide de test — Authentification JWT

Ce guide permet de vérifier que le mécanisme JWT fonctionne correctement de bout en bout dans TicketFlow.

## Prérequis

- Stack lancée : `make up` (ou `docker compose up --build`)
- Frontend accessible sur `http://localhost:5173`
- DevTools du navigateur ouverts (F12)

---

## Test 1 — Connexion et réception du token

**Objectif :** vérifier que le serveur délivre un JWT à la connexion et que le frontend le stocke.

1. Ouvre `http://localhost:5173` → tu es redirigé vers `/login`
2. Ouvre l'onglet **Réseau** (Network) dans les DevTools
3. Connecte-toi avec tes identifiants
4. Dans le panneau Réseau, clique sur la requête `POST /api/users/login`
5. Onglet **Réponse** → tu dois voir :

```json
{
  "user": { "id": "...", "name": "...", "email": "..." },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
}
```

6. Ouvre l'onglet **Application** → **Local Storage** → `http://localhost:5173`
7. Tu dois voir deux entrées :

| Clé | Valeur |
|---|---|
| `tf_token` | `eyJhbGci...` (le JWT) |
| `tf_user` | `{"id":"...","name":"...","email":"..."}` |

**Résultat attendu :** token présent dans le Local Storage, utilisateur redirigé vers `/events`.

---

## Test 2 — Token envoyé dans chaque requête

**Objectif :** vérifier que le header `Authorization: Bearer` est bien transmis.

1. Une fois connecté, reste sur l'onglet **Réseau**
2. Navigue vers `/events`
3. Clique sur la requête `GET /api/events`
4. Onglet **En-têtes** (Headers) → section **Request Headers** → tu dois voir :

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Répète** pour `/events/:id`, `/api/reservations/mine` — le header doit apparaître sur toutes les requêtes.

**Résultat attendu :** chaque appel API inclut le token en Bearer.

---

## Test 3 — Persistence de session après rechargement

**Objectif :** vérifier que la session survit à un F5.

1. Une fois connecté sur `/events`
2. Appuie sur **F5** (rechargement complet de la page)
3. Tu dois rester sur `/events` sans être redirigé vers `/login`
4. Les requêtes réseau doivent toujours inclure le header `Authorization`

**Résultat attendu :** session restaurée depuis le Local Storage, aucune reconnexion nécessaire.

---

## Test 4 — Protection des routes sans token

**Objectif :** vérifier qu'un utilisateur non connecté ne peut pas accéder aux pages protégées.

1. Déconnecte-toi (bouton "Déconnexion")
2. Essaie d'accéder directement à `http://localhost:5173/events`
3. Tu dois être redirigé vers `/login` immédiatement (sans appel API)
4. Essaie aussi `/tickets` et `/checkout` → même résultat

**Résultat attendu :** redirection systématique vers `/login` sans jamais afficher la page.

---

## Test 5 — Détection d'incohérence (token absent, user présent)

**Objectif :** vérifier que l'app gère le cas où `tf_user` existe mais `tf_token` a été supprimé.

1. Connecte-toi normalement
2. Ouvre **Application** → **Local Storage**
3. Supprime uniquement `tf_token` (laisse `tf_user`)
4. Recharge la page (F5)

**Résultat attendu :** tu es redirigé vers `/login` car `AuthContext` détecte l'incohérence et vide les deux entrées au démarrage.

> Sans cette protection, l'app t'aurait laissé passer les `ProtectedRoute` mais tous les appels API auraient échoué en 401.

---

## Test 6 — Expiration / invalidation du token

**Objectif :** vérifier la déconnexion automatique quand le token est refusé par le serveur.

1. Connecte-toi normalement
2. Ouvre la **Console** DevTools et tape :

```js
localStorage.setItem('tf_token', 'token.invalide.ici')
```

3. Navigue vers `/events` ou `/tickets` (sans recharger)
4. L'API répond `401 Unauthorized` avec un token présent

**Résultat attendu :**
- Redirection automatique vers `/login`
- `tf_token` et `tf_user` supprimés du Local Storage
- Pas d'affichage d'erreur brute à l'utilisateur

---

## Test 7 — Parcours complet de bout en bout

**Objectif :** valider l'ensemble du flux authentifié.

| Étape | Action | Résultat attendu |
|---|---|---|
| 1 | Aller sur `/` | Redirect → `/login` |
| 2 | S'inscrire | Token reçu, redirect → `/events` |
| 3 | Cliquer sur un événement | Page `/events/:id` accessible |
| 4 | Sélectionner des sièges et réserver | Redirect → `/checkout` |
| 5 | Confirmer le paiement | Redirect → `/tickets` |
| 6 | Voir ses billets | PDF et QR code affichés |
| 7 | Cliquer "Déconnexion" | Local Storage vidé, redirect → `/login` |
| 8 | Revenir en arrière (bouton navigateur) | Redirect → `/login` (session terminée) |

---

## Vérification via curl (optionnel)

Tu peux aussi tester l'API directement depuis un terminal.

**Connexion et récupération du token :**
```bash
curl -s -X POST http://localhost:4000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ton@email.com","password":"tonmotdepasse"}' | jq .
```

**Utiliser le token pour accéder à une ressource protégée :**
```bash
TOKEN="eyJhbGci..."   # colle ton token ici

curl -s http://localhost:4000/api/events \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Tester avec un token invalide (doit retourner 401) :**
```bash
curl -s http://localhost:4000/api/events \
  -H "Authorization: Bearer token.invalide" | jq .
```
