variable "project_name" {
  type        = string
  description = "Project identifier used in naming conventions"
  default     = "talenthub"
}

variable "environment" {
  type        = string
  description = "Target deployment environment (e.g., dev, staging, prod)"
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "azure_region" {
  type        = string
  description = "Azure region where all resources will be provisioned"
  default     = "eastus"
}

variable "vnet_address_space" {
  type        = list(string)
  description = "Address space CIDR blocks for the TalentHub Virtual Network"
  default     = ["10.0.0.0/16"]
}

variable "frontend_subnet_cidr" {
  type        = list(string)
  description = "Subnet prefix for the frontend / presentation tier"
  default     = ["10.0.1.0/24"]
}

variable "backend_subnet_cidr" {
  type        = list(string)
  description = "Subnet prefix for the Node.js Express backend API tier"
  default     = ["10.0.2.0/24"]
}

variable "database_subnet_cidr" {
  type        = list(string)
  description = "Subnet prefix dedicated for Azure Database for MySQL Flexible Server"
  default     = ["10.0.3.0/24"]
}

variable "mysql_admin_username" {
  type        = string
  description = "Administrator username for Azure Database for MySQL Flexible Server"
  default     = "talenthub_admin"

  validation {
    condition     = length(var.mysql_admin_username) >= 4 && !can(regex("^(azure_superuser|admin|administrator|root|guest|public)$", var.mysql_admin_username))
    error_message = "MySQL administrator username must be at least 4 characters and cannot be a reserved Azure word."
  }
}

variable "mysql_admin_password" {
  type        = string
  description = "Administrator password for MySQL. If left empty, a secure random password will be automatically generated."
  default     = ""
  sensitive   = true
}

variable "mysql_sku_name" {
  type        = string
  description = "SKU tier and compute size for Azure Database for MySQL Flexible Server"
  default     = "B_Standard_B1ms"
}

variable "mysql_version" {
  type        = string
  description = "MySQL major version for Azure Flexible Server"
  default     = "8.0.21"
}

variable "mysql_storage_gb" {
  type        = number
  description = "Storage capacity in GB for Azure Database for MySQL Flexible Server"
  default     = 20
}

variable "tags" {
  type        = map(string)
  description = "Resource tags applied to all provisioned Azure infrastructure"
  default = {
    Project      = "TalentHub ATS"
    ManagedBy    = "Terraform"
    Environment  = "Production"
    Architecture = "3-Tier Secure IaaS/PaaS"
  }
}
