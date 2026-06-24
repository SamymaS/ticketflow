# TicketFlow — Script de soutenance (10 min) + répétition

> Objectif : 10 min de présentation + démo live, puis 5 min de questions.
> Deux temps forts à réussir : **(1) commit poussé en direct → déploiement auto (CD)**, **(2) circuit breaker en action**.

---

## Avant de commencer (checklist 5 min avant)

- [ ] `http://20.215.94.75/` s'ouvre (front visible).
- [ ] Connecté à un compte de test, une réservation **payée** déjà visible dans « Mes billets ».
- [ ] Onglets ouverts : l'app, le repo GitHub (onglet **Actions**), le terminal dans `C:\dev\ticketflow`, le portail Azure (AKS) si tu montres l'infra.
- [ ] `kubectl config current-context` = `ticketflow-aks`.
- [ ] Téléphone prêt pour scanner un QR.
- [ ] La dernière CD est **verte**.

---

## Déroulé (10 minutes)

### 1. Contexte & architecture — 2 min
- « TicketFlow, plateforme de billetterie avec réservation de sièges. Le métier (réserver, payer, émettre un billet) justifie naturellement les patterns cloud-native. »
- Montrer le **schéma d'architecture** (README) : frontend → Traefik → api ; api → payment-gateway (circuit breaker), Redis (verrous), Postgres ; worker (BullMQ) → QR/PDF → stockage objet.
- Citer les 3 microservices et le rôle de chacun.

### 2. Démo du parcours utilisateur — 2 min
Sur `http://20.215.94.75/` :
- Se connecter → liste des événements → **réserver un siège** (mentionner le **verrou Redis** : deux personnes ne peuvent pas prendre le même siège).
- Payer → la réservation passe en **payée**.
- « Mes billets » → ouvrir le **PDF** (servi par l'API, stockage privé) + **scanner le QR** au téléphone → page **« ✓ Billet valide »**.
- Point clé : « le billet (QR + PDF) est généré **en asynchrone** par le worker via un **broker de messages** ; l'API n'attend pas. »

### 3. ⭐ Temps fort 1 — Circuit breaker (résilience) — 1 min 30
- Expliquer : « l'API appelle le service de paiement via un **circuit breaker** (timeout + fallback). Si le paiement tombe, on dégrade proprement au lieu de planter. »
- Démo : augmenter le taux d'échec du payment-gateway et tenter un paiement → réponse **dégradée** (503), pas de crash.
  ```bash
  kubectl set env deployment/payment-gateway FAILURE_RATE=1 -n ticketflow
  # tenter un paiement dans l'app -> échec géré (circuit ouvert / fallback)
  kubectl set env deployment/payment-gateway FAILURE_RATE=0 -n ticketflow   # rétablir
  ```
  > (En local tu peux le montrer pareil via la variable `PAYMENT_FAILURE_RATE` du docker-compose.)

### 4. Infrastructure & IaC — 1 min 30
- Montrer `infra/terraform/` : « toute l'infra Azure (AKS, ACR, Storage, Key Vault) est décrite en **Terraform**, reproductible. »
  ```bash
  terraform output            # acr_login_server, aks_name, resource_group
  ```
- `kubectl get pods -n ticketflow` : montrer les pods (dont **Postgres en StatefulSet**), les probes, la résilience.

### 5. ⭐ Temps fort 2 — Commit live → déploiement auto (CD) — 1 min 30
- « Je modifie un détail visible du front, je commit, je push — et la CI/CD déploie automatiquement en production. »
  ```bash
  # modifier un texte du frontend (ex. un titre)
  git add -A
  git commit -m "demo: changement live en soutenance"
  git push
  ```
- Basculer sur l'onglet **Actions** → montrer le workflow **CD** qui démarre (build des images → push ACR → déploiement AKS).
- Pendant que ça tourne, enchaîner sur la conclusion ; revenir à la fin sur `http://20.215.94.75/` (Ctrl+F5) pour montrer le changement **en ligne**.

### 6. Conclusion & choix assumés — 1 min
- Récap des concepts démontrés (pointer le tableau « concept → fichier » du README).
- Assumer les 3 choix (voir ci-dessous).

---

## Réponses aux choix assumés (préparées)

- **« Pourquoi AKS et pas Azure Container Apps ? »** → ACA était un exemple ; AKS (vrai Kubernetes) nous permet de démontrer StatefulSet, Ingress, probes et HA — une couverture plus complète des concepts du cours.
- **« Pourquoi Postgres dans le cluster et pas une base managée ? »** → choix pédagogique : montrer concrètement un **StatefulSet** avec volume persistant ; en production on basculerait sur une base managée, c'est une variable de configuration.
- **« Le PDF, c'est sécurisé ? »** → le bucket est **privé** ; les PDF passent par une route **API** (`/api/tickets/.../pdf`), jamais par une URL de stockage exposée. Pour durcir : token signé ou vérification du propriétaire.

---

## Questions probables (5 min) — points d'appui

- **Concurrence** : verrou `SET NX EX` (atomique + TTL) dans Redis → `holds.js`. Deux clients ne peuvent pas verrouiller le même siège.
- **Acquittement / fiabilité du broker** : un job BullMQ n'est `completed` que si le handler réussit ; sinon **retries + backoff**, puis **dead-letter**. Worker **idempotent** (contrainte d'unicité `reservation_id, seat_id`).
- **Observabilité** : endpoints `/healthz` + `/readyz` (utilisés par les probes K8s), logs structurés `pino`, arrêt gracieux (SIGTERM). (+ Container Insights si activé.)
- **Scalabilité** : API stateless (JWT) → réplicable horizontalement ; le worker scale indépendamment.
- **Sécurité** : JWT + bcrypt, secrets via Secret K8s / Key Vault, stockage privé.

---

## Répétition — conseils

- **Chronomètre** une fois en entier : vise 9 min pour garder une marge.
- **Lance la CD au bon moment** : le push à l'étape 5, pour qu'elle finisse pendant la conclusion.
- **Plan B si le réseau lâche** : garde des **captures** (front, Actions vert, page « Billet valide », `kubectl get pods`) pour montrer même hors-ligne.
- **Répartition** : Samy (infra/CI-CD/démo technique), Fayrouz (parcours front), Melvin (intro/archi/conclusion).
- Le **circuit breaker** est le moment le plus impressionnant : entraîne-toi à le déclencher proprement (la commande `kubectl set env` redémarre le pod, attends ~10 s avant de tester).
