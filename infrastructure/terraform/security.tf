# ==============================================================================
# TalentHub ATS: Network Security Groups & Least-Privilege Firewall Rules
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Frontend Tier NSG (Presentation / Ingress)
# ------------------------------------------------------------------------------
resource "azurerm_network_security_group" "frontend" {
  name                = "nsg-${local.name_prefix}-frontend"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags

  # Allow HTTP web traffic from public internet
  security_rule {
    name                         = "allow-http-inbound"
    priority                     = 100
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "80"
    source_address_prefix        = "Internet"
    destination_address_prefixes = var.frontend_subnet_cidr
  }

  # Allow HTTPS web traffic from public internet
  security_rule {
    name                         = "allow-https-inbound"
    priority                     = 110
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "443"
    source_address_prefix        = "Internet"
    destination_address_prefixes = var.frontend_subnet_cidr
  }

  # Allow Azure Application Gateway infrastructure communication (if used as ingress)
  security_rule {
    name                       = "allow-gateway-manager"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "65200-65535"
    source_address_prefix      = "GatewayManager"
    destination_address_prefix = "*"
  }

  # Allow frontend to forward API requests to backend Express API (Port 5000)
  security_rule {
    name                         = "allow-backend-api-outbound"
    priority                     = 100
    direction                    = "Outbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "5000"
    source_address_prefixes      = var.frontend_subnet_cidr
    destination_address_prefixes = var.backend_subnet_cidr
  }

  # Explicitly DENY frontend from connecting directly to MySQL Database (Port 3306)
  security_rule {
    name                         = "deny-database-direct-outbound"
    priority                     = 110
    direction                    = "Outbound"
    access                       = "Deny"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "3306"
    source_address_prefixes      = var.frontend_subnet_cidr
    destination_address_prefixes = var.database_subnet_cidr
  }
}

resource "azurerm_subnet_network_security_group_association" "frontend" {
  subnet_id                 = azurerm_subnet.frontend.id
  network_security_group_id = azurerm_network_security_group.frontend.id
}

# ------------------------------------------------------------------------------
# 2. Backend Application Tier NSG (Node.js Express API)
# ------------------------------------------------------------------------------
resource "azurerm_network_security_group" "backend" {
  name                = "nsg-${local.name_prefix}-backend"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags

  # Allow Express API requests (Port 5000) ONLY from the frontend subnet
  security_rule {
    name                         = "allow-frontend-to-backend-api"
    priority                     = 100
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "5000"
    source_address_prefixes      = var.frontend_subnet_cidr
    destination_address_prefixes = var.backend_subnet_cidr
  }

  # Allow Azure health probes to monitor backend API readiness (/health)
  security_rule {
    name                         = "allow-azure-loadbalancer-inbound"
    priority                     = 110
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "5000"
    source_address_prefix        = "AzureLoadBalancer"
    destination_address_prefixes = var.backend_subnet_cidr
  }

  # Deny ALL direct inbound access from the public Internet
  security_rule {
    name                         = "deny-direct-internet-inbound"
    priority                     = 200
    direction                    = "Inbound"
    access                       = "Deny"
    protocol                     = "*"
    source_port_range            = "*"
    destination_port_range       = "*"
    source_address_prefix        = "Internet"
    destination_address_prefixes = var.backend_subnet_cidr
  }

  # Allow backend to communicate with private MySQL Flexible Server on Port 3306
  security_rule {
    name                         = "allow-backend-to-database-outbound"
    priority                     = 100
    direction                    = "Outbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "3306"
    source_address_prefixes      = var.backend_subnet_cidr
    destination_address_prefixes = var.database_subnet_cidr
  }

  # Allow backend egress to Azure Services (Azure AI Document Intelligence, Key Vault, Storage)
  security_rule {
    name                       = "allow-azure-services-outbound"
    priority                   = 110
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefixes    = var.backend_subnet_cidr
    destination_address_prefix = "AzureCloud"
  }

  # Deny arbitrary direct outbound to the Internet
  security_rule {
    name                       = "deny-arbitrary-internet-egress"
    priority                   = 4000
    direction                  = "Outbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefixes    = var.backend_subnet_cidr
    destination_address_prefix = "Internet"
  }
}

resource "azurerm_subnet_network_security_group_association" "backend" {
  subnet_id                 = azurerm_subnet.backend.id
  network_security_group_id = azurerm_network_security_group.backend.id
}

# ------------------------------------------------------------------------------
# 3. Database Tier NSG (Azure Database for MySQL Flexible Server)
# ------------------------------------------------------------------------------
resource "azurerm_network_security_group" "database" {
  name                = "nsg-${local.name_prefix}-database"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags

  # Allow MySQL connections ONLY from the backend subnet on Port 3306
  security_rule {
    name                         = "allow-backend-to-mysql-inbound"
    priority                     = 100
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "3306"
    source_address_prefixes      = var.backend_subnet_cidr
    destination_address_prefixes = var.database_subnet_cidr
  }

  # Allow Azure platform health probes to monitor MySQL instance availability
  security_rule {
    name                         = "allow-azure-loadbalancer-inbound"
    priority                     = 110
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "*"
    source_port_range            = "*"
    destination_port_range       = "*"
    source_address_prefix        = "AzureLoadBalancer"
    destination_address_prefixes = var.database_subnet_cidr
  }

  # Deny all other inbound connections
  security_rule {
    name                       = "deny-all-other-inbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Allow outbound to AzureCloud on Port 443 (required for automated backups and telemetry)
  security_rule {
    name                       = "allow-azure-cloud-outbound"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefixes    = var.database_subnet_cidr
    destination_address_prefix = "AzureCloud"
  }

  # Deny direct Internet outbound
  security_rule {
    name                       = "deny-direct-internet-outbound"
    priority                   = 4096
    direction                  = "Outbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefixes    = var.database_subnet_cidr
    destination_address_prefix = "Internet"
  }
}

resource "azurerm_subnet_network_security_group_association" "database" {
  subnet_id                 = azurerm_subnet.database.id
  network_security_group_id = azurerm_network_security_group.database.id
}
