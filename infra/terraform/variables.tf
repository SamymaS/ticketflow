variable "prefix" {
  description = "Préfixe des ressources"
  type        = string
  default     = "ticketflow"
}

variable "location" {
  description = "Région Azure"
  type        = string
  default     = "francecentral"
}

variable "pg_admin_login" {
  type    = string
  default = "ticketflowadmin"
}

variable "pg_admin_password" {
  description = "Mot de passe admin PostgreSQL (à fournir via TF_VAR_pg_admin_password)"
  type        = string
  sensitive   = true
}
