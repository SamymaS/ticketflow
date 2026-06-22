terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
  }
  # TODO : backend distant pour l'état (Azure Storage) avant de travailler en équipe.
  # backend "azurerm" {}
}

provider "azurerm" {
  features {}
}
