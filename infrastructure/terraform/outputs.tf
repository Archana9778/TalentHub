# ==============================================================================
# TalentHub ATS: Infrastructure & Network Outputs
# ==============================================================================

output "resource_group_name" {
  description = "Name of the provisioned Azure Resource Group"
  value       = azurerm_resource_group.rg.name
}

output "azure_region" {
  description = "Azure region of the provisioned resources"
  value       = azurerm_resource_group.rg.location
}

output "vnet_id" {
  description = "ID of the TalentHub Virtual Network"
  value       = azurerm_virtual_network.vnet.id
}

output "vnet_name" {
  description = "Name of the TalentHub Virtual Network"
  value       = azurerm_virtual_network.vnet.name
}

output "frontend_subnet_id" {
  description = "ID of the Frontend Tier Subnet"
  value       = azurerm_subnet.frontend.id
}

output "backend_subnet_id" {
  description = "ID of the Backend API Tier Subnet"
  value       = azurerm_subnet.backend.id
}

output "database_subnet_id" {
  description = "ID of the Database Tier Delegated Subnet"
  value       = azurerm_subnet.database.id
}

output "frontend_nsg_id" {
  description = "ID of the Frontend Network Security Group"
  value       = azurerm_network_security_group.frontend.id
}

output "backend_nsg_id" {
  description = "ID of the Backend Network Security Group"
  value       = azurerm_network_security_group.backend.id
}

output "database_nsg_id" {
  description = "ID of the Database Network Security Group"
  value       = azurerm_network_security_group.database.id
}

output "backend_route_table_id" {
  description = "ID of the Backend Application Route Table"
  value       = azurerm_route_table.backend.id
}

output "mysql_server_name" {
  description = "Name of the private MySQL Flexible Server"
  value       = azurerm_mysql_flexible_server.mysql.name
}

output "mysql_server_fqdn" {
  description = "Private FQDN of the MySQL Flexible Server (resolved via Private DNS zone)"
  value       = azurerm_mysql_flexible_server.mysql.fqdn
}

output "mysql_database_name" {
  description = "Name of the primary TalentHub database"
  value       = azurerm_mysql_flexible_database.talenthub.name
}

output "mysql_admin_username" {
  description = "Administrator login for MySQL Flexible Server"
  value       = var.mysql_admin_username
}

output "mysql_admin_password" {
  description = "Administrator password for MySQL Flexible Server"
  value       = local.mysql_password
  sensitive   = true
}

output "backend_env_template" {
  description = "Recommended environment variables for the Node.js backend container"
  value       = <<-EOT
    DB_HOST=${azurerm_mysql_flexible_server.mysql.fqdn}
    DB_PORT=3306
    DB_USER=${var.mysql_admin_username}
    DB_PASSWORD=${local.mysql_password}
    DB_NAME=${azurerm_mysql_flexible_database.talenthub.name}
    DB_SSL=true
    DB_MODE=mysql
  EOT
  sensitive   = true
}
