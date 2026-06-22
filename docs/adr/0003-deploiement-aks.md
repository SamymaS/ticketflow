# ADR 0003 — Déploiement AKS via Terraform, minikube en local

## Statut
Accepté

## Contexte
Concepts K8s imposés (StatefulSet, Helm, Traefik) + livrables Terraform/Azure/URL publique. Azure Container Apps masquerait Kubernetes.

## Décision
Terraform -> AKS (Kubernetes managé). minikube pour le dev local et comme filet de sécurité pour la démo.

## Conséquences
Coût Azure à surveiller. En 48h, le déploiement AKS est le poste le plus risqué : la démo doit pouvoir retomber sur minikube.
