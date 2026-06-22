.PHONY: up down logs build ps migrate k8s-apply k8s-delete tf-init tf-plan helm-install

up:        ## Lancer la stack locale
	docker compose up --build

down:      ## Arreter et nettoyer
	docker compose down -v

logs:      ## Suivre les logs
	docker compose logs -f api worker

ps:        ## Etat des services
	docker compose ps

k8s-apply: ## Appliquer les manifests sur le cluster courant (minikube)
	kubectl apply -f infra/k8s/

k8s-delete:
	kubectl delete -f infra/k8s/ --ignore-not-found

tf-init:   ## Initialiser Terraform
	cd infra/terraform && terraform init

tf-plan:
	cd infra/terraform && terraform plan

helm-install: ## Installer le chart applicatif
	helm upgrade --install ticketflow infra/helm/ticketflow -n ticketflow --create-namespace
