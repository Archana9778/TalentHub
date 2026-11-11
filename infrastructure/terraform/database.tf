# ==============================================================================
# TalentHub ATS: Azure Database for MySQL Flexible Server (Private VNet Only)
# ==============================================================================

# Private DNS Zone required for Private VNet Integration of MySQL Flexible Server
resource "azurerm_private_dns_zone" "mysql" {
  name                = "privatelink.mysql.database.azure.com"
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

# Link Private DNS Zone to the TalentHub Virtual Network
resource "azurerm_private_dns_zone_virtual_network_link" "mysql" {
  name                  = "link-${local.name_prefix}-mysql"
  resource_group_name   = azurerm_resource_group.rg.name
  private_dns_zone_name = azurerm_private_dns_zone.mysql.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
  registration_enabled  = false
  tags                  = var.tags
}

# Private Azure Database for MySQL Flexible Server
resource "azurerm_mysql_flexible_server" "mysql" {
  name                   = "mysql-${local.name_prefix}-${random_string.suffix.result}"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  administrator_login    = var.mysql_admin_username
  administrator_password = local.mysql_password
  sku_name               = var.mysql_sku_name
  version                = var.mysql_version

  # Private Network Integration: Delegated Subnet & Private DNS Link
  delegated_subnet_id = azurerm_subnet.database.id
  private_dns_zone_id = azurerm_private_dns_zone.mysql.id

  storage {
    size_gb           = var.mysql_storage_gb
    auto_grow_enabled = true
  }

  backup_retention_days        = 7
  geo_redundant_backup_enabled = false

  tags = var.tags

  depends_on = [
    azurerm_private_dns_zone_virtual_network_link.mysql,
    azurerm_subnet_network_security_group_association.database
  ]
}

# Enforce TLS 1.2+ as the minimum TLS version
resource "azurerm_mysql_flexible_server_configuration" "tls_version" {
  name                = "tls_version"
  resource_group_name = azurerm_resource_group.rg.name
  server_name         = azurerm_mysql_flexible_server.mysql.name
  value               = "TLSv1.2"
}

# Enforce SSL encryption for all incoming connections
resource "azurerm_mysql_flexible_server_configuration" "require_secure_transport" {
  name                = "require_secure_transport"
  resource_group_name = azurerm_resource_group.rg.name
  server_name         = azurerm_mysql_flexible_server.mysql.name
  value               = "ON"
}

# Production TalentHub Database
resource "azurerm_mysql_flexible_database" "talenthub" {
  name                = "talenthub"
  resource_group_name = azurerm_resource_group.rg.name
  server_name         = azurerm_mysql_flexible_server.mysql.name
  charset             = "utf8mb4"
  collation           = "utf8mb4_unicode_ci"
}
