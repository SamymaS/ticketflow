# Manifests Kubernetes

Démontre les concepts du cours : `Deployment`/ReplicaSet, `StatefulSet`, `Service`,
`ConfigMap`/`Secret`, `HorizontalPodAutoscaler`, `PodDisruptionBudget`, probes, `Ingress` Traefik.

## Local (minikube)

```bash
minikube start
# Traefik via Helm :
helm repo add traefik https://traefik.github.io/charts && helm repo update
helm install traefik traefik/traefik -n traefik --create-namespace

kubectl apply -f .                 # tout le dossier
# Construire les images dans le démon de minikube, puis remplacer REGISTRY par l'image locale,
# ou pousser sur ACR et laisser la CI/Helm injecter le tag.
```

> Les images `REGISTRY/ticketflow-*:latest` sont des placeholders : en cloud, la CI pousse sur l'ACR
> et le chart Helm (`infra/helm/ticketflow`) injecte le registre + le tag.
