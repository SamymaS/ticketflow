# Terraform — infrastructure Azure

Provisionne : Resource Group, ACR, AKS (+ AcrPull), PostgreSQL Flexible Server, Key Vault, Storage (Blob).

```bash
az login
export TF_VAR_pg_admin_password='...'      # ne pas committer
terraform init
terraform plan
terraform apply

# Récupérer le kubeconfig du cluster
az aks get-credentials --resource-group $(terraform output -raw resource_group) \
  --name $(terraform output -raw aks_name)
```

> Point de départ : avant un vrai `apply`, configurer le **backend distant** (état partagé),
> ajuster les SKU/tailles selon le budget Azure étudiant, et restreindre les accès réseau
> (PostgreSQL, Key Vault). Les secrets ne sont jamais committés (voir `.gitignore`).
