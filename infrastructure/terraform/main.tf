resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "random_password" "mysql_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
}

locals {
  name_prefix    = "${var.project_name}-${var.environment}"
  mysql_password = var.mysql_admin_password != "" ? var.mysql_admin_password : random_password.mysql_password.result
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${local.name_prefix}"
  location = var.azure_region
  tags     = var.tags
}
