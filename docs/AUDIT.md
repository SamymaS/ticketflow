# Audit de conformité — TicketFlow (soutenance M2 cloud-native)

> Audit réalisé le 2026-06-23 sur la branche `main` (commit `500fa2c`).
> Méthode : lecture des fichiers + commandes non destructives (`terraform fmt/validate`,
> `docker compose config`, `kubectl apply --dry-run=client`, `git log`). Aucune modification appliquée.

## 1. Synthèse

Le projet est **proche de la conformité** : l'architecture cloud-native est réelle et bien
implémentée — les 10 concepts attendus sont presque tous démontrés par du code vérifiable
(circuit breaker opossum, BullMQ avec ack/retry/dead-letter, verrou Redis `SET NX EX`, worker
idempotent, StatefulSet Postgres + PVC, stockage objet S3/MinIO, JWT stateless, probes,
arrêt gracieux). L'IaC Terraform valide, la CI/CD est active (CD sans `if: false`, build des 4
images + déploiement AKS), et les manifests K8s passent le dry-run.

**Mais deux défauts empêchent une démo end-to-end propre sur l'URL publique :**
1. 🔴 le frontend appelle `http://localhost:4000` en dur (la variable `VITE_API_URL` n'est jamais
   injectée au build) → l'app est **cassée derrière Traefik** ;
2. 🟠 les URLs de PDF pointent vers `http://minio:9000` (DNS interne au cluster) → le bouton
   **« Télécharger PDF » ne fonctionne pas** depuis le navigateur en cloud.

Verdict : **conforme sur le fond, à corriger sur 2 points avant la démo live.** Avec les
corrections #1 et #2 ci-dessous (≈30 min de travail), le projet est prêt pour la soutenance.

## 2. Tableau de conformité

### 2.a — Les 7 livrables

| # | Livrable | Statut | Preuve | Ce qui manque |
|---|----------|--------|--------|---------------|
| 1 | Code GitHub, monorepo propre, PR, Issues | ✅ | `git log` : PR #1–#4, branches `feat/*`/`fix/*` ; `.github/ISSUE_TEMPLATE/{bug,feature}.md`, `.github/PULL_REQUEST_TEMPLATE.md` ; `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md` | Protection de `main` non vérifiable depuis le code (réglage GitHub) |
| 2 | IaC Terraform fonctionnel | ✅ | `terraform fmt -check` → exit 0 ; `terraform validate` → « Success! The configuration is valid. » ; `main.tf` RG/ACR/AKS/AcrPull/Storage/KV + `random_string` | `location` par défaut `francecentral` ≠ AKS `polandcentral` (🟡 #8) |
| 3 | CI/CD GitHub Actions | ✅ | `.github/workflows/ci.yml` (matrix build api/worker/payment + `terraform validate`) ; `cd.yml` sans `if: false`, build/push **4** images + `kubectl apply`/`set image`/`rollout` | Présence effective des secrets GitHub (`AZURE_CREDENTIALS`…) non vérifiable depuis le code |
| 4 | URL publique | ⚠️ | Ingress Traefik `infra/k8s-aks/ticketflow.yaml:442` (`/api`→api, `/`→frontend) ; dry-run OK | 🔴 frontend cassé (cf. #1) ; URL publique **absente du README** (🟠 #3) ; non testée en live (apply interdit) |
| 5 | README (schéma + choix + getting-started) | ⚠️ | `README.md` : diagramme Mermaid (l.9), tableau Stack (l.30), démarrage rapide (l.44), démo circuit breaker (l.58) | `.env.example` racine **manquant** alors que le README fait `cp .env.example .env` (🟠 #4) ; pas d'URL publique |
| 6 | Soutenance + commit live → déploiement | ✅ | CD déclenché sur `push main` (`cd.yml:3`) ; chaîne build→push→deploy automatique | Préparer un commit trivial pour la démo ; rien à corriger côté pipeline |
| 7 | Concepts cloud-native | ✅ | cf. tableau 2.b | RAS (voir détails) |

### 2.b — Les 10 concepts cloud-native

| Concept | Statut | Preuve (fichier:ligne) |
|---------|--------|------------------------|
| API stateless + JWT | ✅ | `backend/api/src/auth.js:8` (signToken), `:12` (requireAuth, bcrypt `auth.js:5`) ; aucun état serveur |
| Microservices | ✅ | `backend/api`, `backend/worker`, `backend/payment-gateway` séparés, Dockerfiles distincts |
| Message broker **avec ack** | ✅ | `api/src/queue.js:8` (`attempts:5`, backoff exponentiel, `removeOnFail:false` = dead-letter) ; `worker/src/index.js:20` (ack **uniquement** si le handler réussit) |
| Circuit breaker + timeout | ✅ | `api/src/payment.js:24` (opossum, `timeout`, `errorThresholdPercentage`, `resetTimeout`), `:30` fallback `degraded` ; `routes/reservations.js:62` → **503/402** |
| Concurrence Redis | ✅ | `api/src/holds.js:11` `SET … 'EX' … 'NX'` atomique + TTL ; conflit → libère + `null` → 409 (`reservations.js:20`) |
| Worker idempotent | ✅ | `worker/src/handlers/reservationPaid.js:62` (garde « tickets déjà générés »), `:97` `ON CONFLICT DO NOTHING` + `UNIQUE(reservation_id, seat_id)` (`001_init.sql:64`) |
| StatefulSet Postgres + PVC | ✅ | `k8s-aks/ticketflow.yaml:52` StatefulSet, `:106` `volumeClaimTemplates` (2Gi), Service headless `:45` |
| Stockage objet (QR+PDF) | ✅ | `worker/src/storage.js:5` (`forcePathStyle:true`), `:12` `ensureBucket`, `handlers/reservationPaid.js` QR (`qrcode`) + PDF (`pdf-lib`) ; ⚠️ URL publique cassée en cloud (🟠 #2) |
| Résilience / HA | ✅ | SIGTERM `api/src/server.js:37` & `worker/src/index.js:36` ; HPA + PDB `k8s-local/30-api.yaml:47,65` ; probes partout |
| Observabilité | ✅ | `/healthz` + `/readyz` (`api/src/health.js`, `worker/src/health.js`) ; logs structurés `pino`/`pino-http` (`server.js:17`) |

## 3. Anomalies détectées

### 🔴 Bloquant

**#1 — Frontend : URL d'API absolue codée en dur (`http://localhost:4000`)**
- Fichier : `frontend/src/api.js:1`
  `const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'`
- `VITE_API_URL` n'est défini **nulle part** au build (`grep` global : seule occurrence = la lecture
  ci-dessus ; absent de `frontend/Dockerfile` et de `cd.yml`). L'image nginx est donc construite avec
  `localhost:4000` figé. En cloud, le navigateur appelle `http://localhost:4000/api/...` (la machine de
  l'utilisateur) → **toutes les requêtes échouent derrière Traefik**. L'Ingress route pourtant bien
  `/api`→api, mais le front ne s'en sert pas.
- En dev local ça « marche » par accident grâce au proxy Vite (`vite.config.js:7`), masquant le bug.
- **Correction** : rendre les appels **relatifs** —
  `const BASE_URL = import.meta.env.VITE_API_URL || ''` → requêtes vers `/api/...`, routées par Traefik.

### 🟠 Important

**#2 — Téléchargement PDF cassé en cloud (S3_PUBLIC_URL interne)**
- Fichier : `infra/k8s-aks/ticketflow.yaml:24` → `S3_PUBLIC_URL: "http://minio:9000"`.
- `putObject` renvoie `${S3_PUBLIC_URL}/tickets/...` (`worker/src/storage.js:35`), stocké dans
  `tickets.pdf_url` et utilisé en `href` direct (`MyTicketsPage.jsx:93`). `minio:9000` est un nom DNS
  **interne au cluster**, non joignable depuis le navigateur ; MinIO n'est pas exposé par l'Ingress.
  → bouton « Télécharger PDF » mort en cloud (le QR, lui, est régénéré côté client, donc OK).
- **Correction** : exposer MinIO via l'Ingress (ex. `path: /tickets` → service `minio:9000`) et fixer
  `S3_PUBLIC_URL` à l'URL publique correspondante ; ou servir les PDF via un endpoint de l'API.

**#3 — URL publique absente du README**
- `README.md` ne mentionne aucune URL publique (livrables #4 et #5). Le correcteur doit pouvoir cliquer.
- **Correction** : ajouter l'IP/host Traefik (`kubectl get ingress -n ticketflow`) dans le README.

**#4 — `.env.example` racine manquant**
- `README.md:47` indique `cp .env.example .env`, mais `git ls-files` ne contient **pas** de
  `.env.example` à la racine (seul `backend/worker/.env.example` existe). Getting-started non
  reproductible tel quel. *(Un `.env` réel existe en local mais est bien ignoré : `git check-ignore .env` → ignoré, non tracké.)*
- **Correction** : committer un `.env.example` racine couvrant `PGPASSWORD`, `JWT_SECRET`,
  `S3_ACCESS_KEY/SECRET`, `PAYMENT_FAILURE_RATE`, etc.

**#5 — Pas de service `frontend` (ni `adminer`) dans `docker-compose.yml`**
- `docker-compose.yml` lance postgres/redis/minio/payment-gateway/api/worker mais **pas le frontend**.
  `docker compose up` ne montre donc pas l'UI ; la démo locale « tout-en-un » est incomplète
  (le front tourne via `npm run dev`). À clarifier si c'est voulu.
- **Correction** : ajouter un service `frontend` (build `./frontend`, port `8080:80`) au compose.

### 🟡 Cosmétique / bonus

**#6 — Incohérences de documentation**
- `docs/architecture.md:28` mentionne « Terraform (… PostgreSQL …) » et « Helm déploie sur l'AKS »,
  alors que Postgres tourne **en StatefulSet** (pas de Postgres managé dans `main.tf`) et que la CD
  utilise `kubectl apply` (pas Helm). Le chart `infra/helm/` est par ailleurs **incomplet**
  (templates api/worker/payment/configmap/ingress seulement — pas de postgres/redis/minio/frontend/secret).
- **Correction** : aligner la doc sur la réalité (StatefulSet + `kubectl apply`), ou retirer/compléter le chart Helm.

**#7 — Règle `.gitignore` de secret obsolète**
- `.gitignore:24` ignore `infra/k8s/*secret*.yaml`, mais les répertoires actifs sont `k8s-local/` et
  `k8s-aks/`. Un vrai secret déposé là ne serait **pas** ignoré. (Aucun secret réel n'est committé à ce jour.)
- **Correction** : élargir la règle, ex. `infra/**/secret*.yaml` + `!**/secret*.example.yaml`.

**#8 — Région Terraform incohérente**
- `variables.tf:9` `location` par défaut `francecentral` ; `main.tf:23` AKS codé en dur `polandcentral`.
  RG/ACR/Storage/KV partent donc en `francecentral`, l'AKS en `polandcentral` (multi-région inutile).
- **Correction** : utiliser `var.location` partout (et fixer le défaut à `polandcentral`).

**#9 — Pas de table « concept attendu → implémentation »**
- `docs/architecture.md` liste les patterns en bullets mais sans référence fichier. Proposé : reprendre
  le **tableau 2.b** ci-dessus dans `architecture.md` (concept → `fichier:ligne`).

**#10 — Duplication `infra/k8s/` ⟷ `infra/k8s-local/`**
- Deux répertoires quasi identiques → confusion. `infra/k8s/` semble obsolète.
- **Correction** : supprimer/fusionner et ne garder que `k8s-local` (+ `k8s-aks`).

**#11 — Lint/test factices**
- `scripts.lint` = `echo "lint: TODO (eslint)"` (api/worker) ; le worker n'a aucun test.
  Le seul test est `api/test/config.test.js` (smoke test trivial). La CI fait `npm test --if-present`
  donc ne casse pas, mais la couverture est symbolique.
- **Correction** : ESLint réel + au moins un test d'intégration sur `holdSeats`/idempotence (bonus).

**#12 — Ingress local sans route frontend**
- `k8s-local/50-ingress.yaml` et `helm/.../ingress.yaml` ne routent que `/api` (pas de `/`→frontend),
  contrairement au manifest AKS. Sans impact cloud (variant local).

## 4. Plan de corrections priorisé (à valider — rien n'est appliqué)

**Avant la soutenance (obligatoire) :**
1. [🔴 #1] `frontend/src/api.js` → `const BASE_URL = import.meta.env.VITE_API_URL || ''` (appels relatifs).
2. [🟠 #2] Exposer MinIO via l'Ingress (`/tickets`→`minio:9000`) **et** mettre `S3_PUBLIC_URL` à l'URL
   publique correspondante dans `k8s-aks/ticketflow.yaml` (sinon désactiver le lien PDF pour la démo).
3. [🟠 #3] Ajouter l'URL publique Traefik dans le `README.md`.
4. [🟠 #4] Committer un `.env.example` à la racine, cohérent avec `docker-compose.yml`.

**Confort de démo :**
5. [🟠 #5] Ajouter le service `frontend` au `docker-compose.yml`.
6. [🟡 #6] Corriger `architecture.md` (StatefulSet + kubectl, pas Postgres managé / Helm).
7. [🟡 #9] Intégrer la table « concept → fichier » dans `architecture.md`.

**Nettoyage (bonus) :**
8. [🟡 #7] Durcir la règle `.gitignore` des secrets.
9. [🟡 #8] Unifier la région Terraform.
10. [🟡 #10/#11/#12] Dédupliquer `infra/k8s`, ESLint/test réels, route frontend dans l'ingress local.

## 5. Questions / incertitudes

- **URL publique live** : non testée (`kubectl apply`/accès réseau interdits par les règles d'audit).
  Le `--dry-run=client` indique qu'un cluster est connecté (objets « configured ») et que `frontend`
  serait « created » → à confirmer que le frontend est bien déployé et l'IP Traefik attribuée.
- **Secrets GitHub** (`AZURE_CREDENTIALS`, `ACR_LOGIN_SERVER`, `AKS_RESOURCE_GROUP`, `AKS_NAME`) :
  référencés correctement dans `cd.yml` mais leur **existence/validité** dans les settings du repo
  n'est pas vérifiable depuis le code.
- **`terraform init`** : a subi une erreur réseau pendant l'audit ; `terraform validate` a néanmoins
  réussi (provider en cache). Un `init` propre depuis zéro n'a pas pu être confirmé.
- **`npm ci/test`** non exécutés (pas d'installation de dépendances) ; la CI s'appuie sur
  `npm install` + `npm test --if-present`.
- **Protection de la branche `main`** : réglage GitHub, non vérifiable depuis le dépôt.
