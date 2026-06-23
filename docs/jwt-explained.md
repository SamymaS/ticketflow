# Fonctionnement du JWT et du Bearer Token dans TicketFlow

## Qu'est-ce qu'un JWT ?

Un **JSON Web Token** (JWT) est un jeton d'authentification autonome : il contient lui-même les informations nécessaires pour identifier l'utilisateur, sans que le serveur ait besoin de consulter une base de données à chaque requête.

Il se présente sous la forme d'une chaîne en trois parties séparées par des points :

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   ← Header
.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE3...   ← Payload
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV   ← Signature
```

### Le Header
Indique l'algorithme de signature utilisé.
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Le Payload
Contient les données de l'utilisateur (appelées *claims*). Dans TicketFlow :
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1719100800,
  "exp": 1719187200
}
```

| Champ | Signification |
|---|---|
| `userId` | Identifiant de l'utilisateur en base |
| `iat` | *Issued At* — timestamp de création |
| `exp` | *Expiration* — timestamp d'expiration |

> Le payload est encodé en **Base64**, pas chiffré. N'importe qui peut le lire. C'est la **signature** qui garantit qu'il n'a pas été falsifié.

### La Signature
Calculée avec la clé secrète du serveur (`JWT_SECRET` dans `.env`) :
```
HMACSHA256(
  base64url(header) + "." + base64url(payload),
  "ma_cle_secrete"
)
```
Si quelqu'un modifie le payload (ex. change `userId`), la signature ne correspond plus et le serveur rejette le token.

---

## Comment le JWT est créé (côté serveur)

**Fichier :** `backend/api/src/routes/users.js`

À la connexion, le serveur :
1. Vérifie l'email et le mot de passe (hash bcrypt)
2. Génère un JWT signé avec `JWT_SECRET`
3. Le renvoie dans la réponse HTTP

```js
const token = jwt.sign(
  { userId: user.id },      // payload : identifiant de l'utilisateur
  config.jwtSecret,         // clé secrète (définie dans .env)
  { expiresIn: '24h' }      // expiration
)
res.json({ user, token })
```

---

## Comment le JWT est vérifié (côté serveur)

**Fichier :** `backend/api/src/auth.js`

Le middleware `requireAuth` protège toutes les routes sensibles. Il :
1. Lit le header `Authorization: Bearer <token>`
2. Vérifie la signature et l'expiration avec `jwt.verify()`
3. Injecte `req.userId` pour que les routes puissent l'utiliser

```js
export function requireAuth(req, res, next) {
  const header = req.headers.authorization        // "Bearer eyJ..."
  const token  = header?.split(' ')[1]            // "eyJ..."

  if (!token) return res.status(401).json({ error: 'Token manquant' })

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}
```

---

## Comment le JWT est stocké (côté frontend)

**Fichier :** `frontend/src/AuthContext.jsx`

À la connexion réussie, `saveAuth()` stocke le token et le profil utilisateur dans le `localStorage` du navigateur :

```js
function saveAuth(userData, token) {
  localStorage.setItem('tf_token', token)               // le JWT brut
  localStorage.setItem('tf_user', JSON.stringify(userData)) // infos affichées
  setUser(userData)                                     // état React
}
```

Au chargement de l'application, les deux sont relus pour restaurer la session :

```js
const [user, setUser] = useState(() => {
  const raw   = localStorage.getItem('tf_user')
  const token = localStorage.getItem('tf_token')
  if (!raw || !token) {
    // Incohérence → on repart d'un état vierge
    localStorage.removeItem('tf_user')
    localStorage.removeItem('tf_token')
    return null
  }
  return JSON.parse(raw)
})
```

À la déconnexion, tout est supprimé :

```js
function clearAuth() {
  localStorage.removeItem('tf_token')
  localStorage.removeItem('tf_user')
  setUser(null)
}
```

### Pourquoi localStorage et pas les cookies ?

| Critère | localStorage | Cookie HttpOnly |
|---|---|---|
| Accessible en JS | Oui | Non |
| Protection CSRF | Manuelle | Automatique |
| Protection XSS | Vulnérable | Protégé |
| Simplicité | Très simple | Nécessite config serveur |

TicketFlow utilise `localStorage` pour sa simplicité dans un contexte de démonstration. En production, un cookie `HttpOnly` + `Secure` + `SameSite=Strict` serait préférable car il est inaccessible au JavaScript et donc protégé contre les attaques XSS.

---

## Comment le Bearer Token est envoyé (côté frontend)

**Fichier :** `frontend/src/api.js`

Chaque appel API passe par la fonction `request()`. Elle lit automatiquement le token et l'ajoute dans le header HTTP :

```js
async function request(path, options = {}) {
  const token = localStorage.getItem('tf_token')
  const headers = { 'Content-Type': 'application/json' }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  // ...
}
```

Le format `Bearer <token>` est un standard HTTP (RFC 6750). Le mot-clé `Bearer` signifie littéralement *"porteur"* : celui qui porte le token peut l'utiliser.

---

## Gestion de l'expiration

**Fichier :** `frontend/src/api.js`

Si le serveur répond `401` alors qu'un token était présent dans la requête, cela signifie que le token est expiré ou a été révoqué. Le frontend déconnecte automatiquement l'utilisateur :

```js
if (res.status === 401 && token) {
  localStorage.removeItem('tf_token')
  localStorage.removeItem('tf_user')
  window.location.replace('/login')  // replace évite de pouvoir "revenir en arrière"
  return null
}
```

La condition `&& token` est essentielle : sans elle, un mauvais mot de passe à la connexion (qui retourne aussi 401) déclencherait une redirection involontaire.

---

## Schéma du flux complet

```
┌─────────────────────────────────────────────────────────────────┐
│  CONNEXION                                                      │
│                                                                 │
│  Frontend          POST /api/users/login                        │
│  ──────────────────────────────────────────────► API           │
│                    { email, password }                          │
│                                                                 │
│  Frontend          { user, token: "eyJ..." }                    │
│  ◄────────────────────────────────────────────── API           │
│                                                                 │
│  localStorage.setItem('tf_token', token)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  REQUÊTE PROTÉGÉE                                               │
│                                                                 │
│  Frontend          GET /api/events                              │
│                    Authorization: Bearer eyJ...                 │
│  ──────────────────────────────────────────────► API           │
│                                                                 │
│                    jwt.verify(token, JWT_SECRET)                │
│                    ✓ Valide → req.userId = "550e..."            │
│                                                                 │
│  Frontend          { events: [...] }                            │
│  ◄────────────────────────────────────────────── API           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TOKEN EXPIRÉ                                                   │
│                                                                 │
│  Frontend          GET /api/events                              │
│                    Authorization: Bearer eyJ... (expiré)        │
│  ──────────────────────────────────────────────► API           │
│                                                                 │
│                    jwt.verify() → TokenExpiredError             │
│                    ✗ Invalide → 401 Unauthorized                │
│                                                                 │
│  Frontend          401 reçu + token présent                     │
│  ◄────────────────────────────────────────────── API           │
│                                                                 │
│  localStorage.removeItem('tf_token')                            │
│  localStorage.removeItem('tf_user')                             │
│  window.location.replace('/login')                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fichiers clés à retenir

| Fichier | Rôle |
|---|---|
| `backend/api/src/routes/users.js` | Génère le JWT à la connexion/inscription |
| `backend/api/src/auth.js` | Middleware qui vérifie le JWT sur chaque route protégée |
| `frontend/src/AuthContext.jsx` | Stocke et restaure la session (token + user) |
| `frontend/src/api.js` | Injecte le Bearer token dans chaque requête HTTP |
| `frontend/src/App.jsx` | `ProtectedRoute` bloque les pages sans session valide |
