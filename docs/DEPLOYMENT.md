# TicketFlow — Guide de déploiement complet

Ce document permet à n'importe qui de **récupérer le projet, le lancer en local, et le déployer en cloud** (Azure AKS) via la pipeline CI/CD.

---

## 0. Constantes du projet

| Élément | Valeur |
|---|---|
| Dépôt GitHub | `https://github.com/SamymaS/ticketflow` (privé) |
| Dossier local (exemple) | `C:\dev\ticketflow` |
| Registre d'images (ACR) | `ticketflowacre4z4.azurecr.io` |
| Resource group Azure | `ticketflow-rg` |
| Cluster AKS | `ticketflow-aks` |
| Région / VM | `polandcentral` / `Standard_B2s_v2` (1 nœud) |
| Namespace Kubernetes | `ticketflow` |
| **URL publique (live)** | `http://20.215.94.75` |
| Souscription Azure | `bd2195a6-c483-4966-81dd-8b3f6a8f41fa` |

**Identifiants de dev** (locaux, non sensibles) : PostgreSQL `ticketflow` / `ticketflow_dev_pw` · MinIO `minioadmin` / `minioadmin`.

**Ports** : frontend (Vite) `5173` · API `4000` · payment-gateway `4200` · worker (health) `4100` · PostgreSQL `5432` · Redis `6379` · MinIO `9000` (S3) / `9001` (console) · Adminer `8080`.

**Images** : `ticketflow-api`, `ticketflow-worker`, `ticketflow-payment-gateway`, `ticketflow-frontend`.

> Il existe **3 environnements** : Docker Compose (local), Kubernetes Docker Desktop (local), AKS (cloud). Réflexe avant toute commande `kubectl` : `kubectl config current-context`.

---

## 1. Architecture (rappel)

- **frontend** (Vite/React, nginx) → appels API en relatif `/api/...`.
- **api** (Express, stateless, JWT) → événements, verrou de sièges, checkout. Appelle le **payment-gateway** via un **circuit breaker** (opossum), puis publie `reservation.paid`. Sert aussi les PDF de billets et la page de vérification (`/api/tickets/...`).
- **worker** (BullMQ) → génère QR + PDF par billet, upload vers le stockage objet, idempotent.
- **payment-gateway** → mock de paiement (`FAILURE_RATE` / `LATENCY_MS`).
- **PostgreSQL** (StatefulSet) · **Redis** (verrous + broker + cache) · **MinIO** / Azure Blob (stockage objet).

---

## 2. Prérequis

**Pour le local** : Docker Desktop, Node.js 20+, Git.
**Pour le cloud** : un compte Azure (ex. Azure for Students), Azure CLI (`az`), `kubectl`, `helm`, `terraform`.

Accès indispensables :
- Être **collaborateur** du dépôt GitHub (Settings → Collaborators) — le repo est privé.
- Pour le cloud : être propriétaire d'une souscription Azure.

---

## 3. Récupérer le code

```bash
git clone https://github.com/SamymaS/ticketflow.git
cd ticketflow
```

---

## 4. Lancer en LOCAL (Docker Compose) — le plus simple

Depuis la racine du repo :

```bash
docker compose up --build        # build + démarre postgres, redis, minio, payment-gateway, api, worker, adminer
docker compose ps                # tout doit être Up / healthy
```

Lancer le frontend (dans un second terminal) :

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

**Tester** : ouvrir `http://localhost:5173`, créer un compte (page S'inscrire), réserver des sièges, payer, consulter « Mes billets » (PDF + QR).

Vérifs utiles :
```bash
curl http://localhost:4000/healthz          # API en vie
docker compose logs -f api                   # logs API
docker compose logs -f worker                # logs worker (génération billets)
```

Arrêt :
```bash
docker compose down                          # stoppe tout
docker compose down -v                       # stoppe ET efface les données (reset)
```

---

## 5. Inspecter la base & le stockage (local)

**Adminer** (dashboard web, démarré avec la stack) : `http://localhost:8080`
→ Système **PostgreSQL** · Serveur `postgres` · Utilisateur `ticketflow` · MDP `ticketflow_dev_pw` · Base `ticketflow`.

**psql en ligne de commande** :
```bash
docker compose exec postgres psql -U ticketflow -d ticketflow -c "\dt"
docker compose exec postgres psql -U ticketflow -d ticketflow -c "SELECT status, COUNT(*) FROM seats GROUP BY status;"
```

**Console MinIO** (PDF des billets) : `http://localhost:9001` (`minioadmin` / `minioadmin`), bucket `tickets`.

---

## 6. Kubernetes en LOCAL (optionnel, Docker Desktop)

Activer Kubernetes dans Docker Desktop, puis :

```bash
kubectl config use-context docker-desktop
kubectl apply -f infra/k8s-local
kubectl get pods -n ticketflow
```

Ingress Traefik (si le port 80 est libre) ou via port-forward :
```bash
kubectl port-forward -n traefik svc/traefik 8000:80
curl -H "Host: ticketflow.local" http://localhost:8000/api/events    # 401 = routage OK
```

---

## 7. Déployer en CLOUD (Azure AKS) — depuis zéro

### 7.1 Connexion Azure
```bash
az login
az account show                  # confirmer la souscription
```

### 7.2 Provisionner l'infra avec Terraform
```bash
cd infra/terraform
terraform init
terraform plan
terraform apply                  # taper "yes" — crée RG, ACR, AKS, rôle AcrPull, Storage, Key Vault
terraform output                 # acr_login_server, aks_name, resource_group
```

> **Important (comptes étudiants)** : la région et la taille de VM sont contraintes. Ici `polandcentral` + `Standard_B2s_v2`. Pour trouver les régions autorisées : Portail Azure → Policy → Assignments → « Allowed resource deployment regions ». Pour vérifier une VM : `az vm list-skus --location <region> --size Standard_B2s --query "[].name" -o tsv`.
>
> Le **nom de l'ACR est unique** (suffixe aléatoire). Si tu redéploies à neuf, récupère-le via `terraform output acr_login_server` et **mets à jour les références d'image** dans `infra/k8s-aks/ticketflow.yaml` et le secret `ACR_LOGIN_SERVER` (voir §8).

### 7.3 Connecter kubectl à l'AKS
```bash
az aks get-credentials --resource-group ticketflow-rg --name ticketflow-aks --overwrite-existing
kubectl config use-context ticketflow-aks
kubectl get nodes                # 1 nœud Ready
```

### 7.4 Builder et pousser les 4 images vers l'ACR
> `az acr build` est **bloqué** sur les souscriptions étudiantes → on build en local et on push.
```bash
az acr login --name ticketflowacre4z4
# depuis la racine du repo :
docker build -t ticketflowacre4z4.azurecr.io/ticketflow-api:latest backend/api
docker build -t ticketflowacre4z4.azurecr.io/ticketflow-worker:latest backend/worker
docker build -t ticketflowacre4z4.azurecr.io/ticketflow-payment-gateway:latest backend/payment-gateway
docker build -t ticketflowacre4z4.azurecr.io/ticketflow-frontend:latest frontend
docker push ticketflowacre4z4.azurecr.io/ticketflow-api:latest
docker push ticketflowacre4z4.azurecr.io/ticketflow-worker:latest
docker push ticketflowacre4z4.azurecr.io/ticketflow-payment-gateway:latest
docker push ticketflowacre4z4.azurecr.io/ticketflow-frontend:latest
az acr repository list -n ticketflowacre4z4 -o table     # doit lister les 4 dépôts
```

### 7.5 Déployer la stack applicative
```bash
kubectl apply -f infra/k8s-aks/ticketflow.yaml
kubectl get pods -n ticketflow -w        # attendre que tout soit Running (l'api peut redémarrer 1-2x le temps que Postgres soit prêt)
```

### 7.6 Installer Traefik (Ingress) et récupérer l'URL publique
```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm install traefik traefik/traefik -n traefik --create-namespace
kubectl get svc -n traefik traefik -w    # attendre que EXTERNAL-IP passe de <pending> à une IP publique
```

Tester (remplacer par l'IP obtenue, ici `20.215.94.75`) :
```bash
curl http://20.215.94.75/api/events       # {"error":"Token manquant"} = l'API répond via Traefik
# puis ouvrir http://20.215.94.75/ dans un navigateur → le frontend
```

---

## 8. Pipeline CI/CD (GitHub Actions)

### 8.1 Ce que font les workflows
- **`.github/workflows/ci.yml`** : sur chaque push/PR → build des services backend + `terraform validate`.
- **`.github/workflows/cd.yml`** : sur push vers `main` → build/push des **4 images** vers l'ACR, puis déploiement AKS (`kubectl apply` + `kubectl set image` lié au SHA du commit).

### 8.2 Secrets GitHub requis (Settings → Secrets and variables → Actions)
| Secret | Valeur |
|---|---|
| `AZURE_CREDENTIALS` | JSON du service principal (voir 8.3) |
| `ACR_LOGIN_SERVER` | `ticketflowacre4z4.azurecr.io` |
| `AKS_RESOURCE_GROUP` | `ticketflow-rg` |
| `AKS_NAME` | `ticketflow-aks` |

### 8.3 Créer le service principal (identifiants de déploiement)
```bash
az ad sp create-for-rbac --name "ticketflow-cd" \
  --role Contributor \
  --scopes /subscriptions/bd2195a6-c483-4966-81dd-8b3f6a8f41fa/resourceGroups/ticketflow-rg \
  --sdk-auth
```
Copier **tout le bloc JSON** affiché → le coller dans le secret `AZURE_CREDENTIALS`.
> ⚠️ Ne jamais committer ce JSON (il contient un mot de passe). Certains tenants d'école bloquent cette commande ; dans ce cas, utiliser à la place l'admin de l'ACR + le kubeconfig admin de l'AKS comme secrets.

### 8.4 Déclencher un déploiement
Une fois les secrets posés, **tout push sur `main` déploie automatiquement** :
```bash
git add .
git commit -m "feat: ma modification"
git push                                  # → onglet Actions → workflow "CD" → déploiement AKS
```
C'est le « commit live » de la démo : pousser un changement et le voir se propager jusqu'à l'URL publique.

---

## 9. Mettre à jour le déploiement manuellement (sans CI/CD)

Après un changement de code, pour rafraîchir le cloud à la main :
```bash
az acr login --name ticketflowacre4z4
docker build -t ticketflowacre4z4.azurecr.io/ticketflow-api:latest backend/api
docker push ticketflowacre4z4.azurecr.io/ticketflow-api:latest
kubectl rollout restart deployment/api -n ticketflow      # force le re-pull
```
(Idem pour `worker`, `payment-gateway`, `frontend`.)

---

## 10. Nettoyage (après la démo, pour ne rien payer)

```bash
cd infra/terraform
terraform destroy                          # supprime TOUTE l'infra Azure
```
En local : `docker compose down`.

---

## 11. Dépannage (pièges rencontrés)

| Symptôme | Cause / solution |
|---|---|
| `kubectl` agit sur le mauvais cluster | `kubectl config current-context` ; basculer avec `kubectl config use-context docker-desktop` ou `ticketflow-aks`. |
| `curl localhost` renvoie une page Apache | Apache/XAMPP occupe le port 80 ; le stopper, ou utiliser un port-forward. |
| `az acr build` → `TasksOperationsNotAllowed` | Normal sur compte étudiant ; builder en local + `docker push` (§7.4). |
| AKS `BadRequest` sur la VM ou `RequestDisallowedByAzure` | Région/VM non autorisées ; voir la note §7.2 (régions et SKU autorisés). |
| `terraform apply` → « resource already exists » | Importer la ressource : `terraform import <addr> <id>`, puis re-`apply`. |
| Pod `ImagePullBackOff` | Vérifier que l'image est dans l'ACR et que le rôle AcrPull est attribué. |
| PDF `AccessDenied` / hôte `minio` introuvable | Le lien doit être relatif `/api/tickets/.../pdf` (servi par l'API), pas l'URL MinIO directe. |
| Front « Failed to fetch » en local | Vérifier le proxy Vite (`/api` → `http://localhost:4000`) dans `frontend/vite.config.js`, et que l'API tourne. |

---

## 12. Arborescence utile

```
ticketflow/
├─ backend/
│  ├─ api/            (Express, JWT, circuit breaker, routes tickets/PDF/verify)
│  ├─ worker/         (BullMQ, QR + PDF, upload stockage objet)
│  └─ payment-gateway/(mock paiement)
├─ frontend/          (Vite/React)
├─ infra/
│  ├─ terraform/      (IaC Azure : RG, ACR, AKS, Storage, Key Vault)
│  ├─ k8s-aks/        (ticketflow.yaml : déploiement cloud)
│  └─ k8s-local/      (déploiement Kubernetes local)
├─ docs/              (architecture, ADR, contrat d'API, ERD base, ce guide)
├─ .github/workflows/ (ci.yml, cd.yml)
└─ docker-compose.yml (stack locale + Adminer)
```
