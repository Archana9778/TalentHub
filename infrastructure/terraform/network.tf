# ==============================================================================
# TalentHub ATS: Azure Virtual Network & Subnet Topology
# ==============================================================================

resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-${local.name_prefix}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  address_space       = var.vnet_address_space
  tags                = var.tags
}

# --- Tier 1: Frontend Subnet (Public/Ingress or Reverse Proxy) ---
resource "azurerm_subnet" "frontend" {
  name                 = "snet-frontend"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = var.frontend_subnet_cidr
}

# --- Tier 2: Backend Application Subnet (Node.js Express API) ---
resource "azurerm_subnet" "backend" {
  name                 = "snet-backend"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = var.backend_subnet_cidr
}

# --- Tier 3: Database Subnet (Delegated to Azure Database for MySQL) ---
resource "azurerm_subnet" "database" {
  name                 = "snet-database"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = var.database_subnet_cidr

  delegation {
    name = "mysql-flexible-delegation"

    service_delegation {
      name = "Microsoft.DBforMySQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action"
      ]
    }
  }
}

# ==============================================================================
# Route Tables: Application Tier Egress Control
# Note: Azure actively manages platform routing on delegated MySQL subnets.
# Custom UDRs with 0.0.0.0/0 -> None are applied to the Backend application tier
# to enforce controlled routing without breaking MySQL automated backups & telemetry.
# ==============================================================================

resource "azurerm_route_table" "backend" {
  name                          = "rt-${local.name_prefix}-backend"
  location                      = azurerm_resource_group.rg.location
  resource_group_name           = azurerm_resource_group.rg.name
  disable_bgp_route_propagation = false
  tags                          = var.tags
}

resource "azurerm_subnet_route_table_association" "backend" {
  subnet_id      = azurerm_subnet.backend.id
  route_table_id = azurerm_route_table.backend.id
}
