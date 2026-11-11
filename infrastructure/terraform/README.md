# TalentHub ATS — Azure Networking & Security Infrastructure (Terraform)

This directory contains the production-ready, modular Terraform infrastructure code provisioning an enterprise **3-Tier Azure Virtual Network & Security Configuration** for the TalentHub ATS platform (React frontend, Node.js + Express backend API, and private Azure Database for MySQL Flexible Server).

---

## 1. 🏗️ Network Architecture

The architecture enforces strict network isolation across three distinct tiers:
1. **Tier 1 (Presentation)**: Public ingress for web traffic (HTTP/S) and reverse proxying to the application API.
2. **Tier 2 (Application)**: Internal Node.js Express API listening on Port 5000, completely shielded from direct internet ingress.
3. **Tier 3 (Data)**: Azure Database for MySQL Flexible Server injected directly into a dedicated delegated subnet with private DNS resolution, zero public IP, and enforced TLS 1.2+ encryption.

```
+-------------------------------------------------------------------------------------------------------+
|  Azure Virtual Network: vnet-talenthub-prod (10.0.0.0/16)                                             |
|                                                                                                       |
|   +-----------------------------------------------------------------------------------------------+   |
|   |  Subnet: snet-frontend (10.0.1.0/24) | NSG: nsg-talenthub-frontend                            |   |
|   |  • Inbound: HTTP (80) & HTTPS (443) from Internet                                             |   |
|   |  • Inbound: TCP 65200-65535 from GatewayManager (App Gateway / WAF health)                    |   |
|   |  • Outbound: TCP 5000 to snet-backend ONLY                                                    |   |
|   |  • Outbound: TCP 3306 to snet-database (EXPLICITLY DENIED)                                    |   |
|   +-----------------------------------------------+-----------------------------------------------+   |
|                                                   | TCP 5000 (Internal VNet Traffic)                  |
|                                                   v                                                   |
|   +-----------------------------------------------------------------------------------------------+   |
|   |  Subnet: snet-backend (10.0.2.0/24) | NSG: nsg-talenthub-backend | Route Table: rt-backend       |   |
|   |  • Inbound: TCP 5000 from snet-frontend ONLY (Internet Ingress BLOCKED)                       |   |
|   |  • Inbound: TCP 5000 from AzureLoadBalancer (Health Probes)                                  |   |
|   |  • Outbound: TCP 3306 to snet-database ONLY                                                   |   |
|   |  • Outbound: HTTPS (443) to AzureCloud (Azure AI Document Intel, Key Vault, Storage)          |   |
|   |  • Outbound: Arbitrary direct Internet egress (EXPLICITLY DENIED)                             |   |
|   +-----------------------------------------------+-----------------------------------------------+   |
|                                                   | TCP 3306 (TLS 1.2+ Enforced)                      |
|                                                   v                                                   |
|   +-----------------------------------------------------------------------------------------------+   |
|   |  Subnet: snet-database (10.0.3.0/24) | NSG: nsg-talenthub-database                            |   |
|   |  • Subnet Delegation: Microsoft.DBforMySQL/flexibleServers                                    |   |
|   |  • Platform Routing: Azure Managed (UDRs isolated to backend tier to preserve backups)        |   |
|   |  • Inbound: TCP 3306 from snet-backend ONLY                                                   |   |
|   |  • Inbound: AzureLoadBalancer health probes allowed                                           |   |
|   |  • Outbound: HTTPS 443 to AzureCloud allowed (automated backups & telemetry)                  |   |
|   |  • Outbound: Direct Internet egress (EXPLICITLY DENIED)                                       |   |
|   |  • Public Network Access: DISABLED (No public IP address)                                     |   |
|   |  • Private DNS Zone: privatelink.mysql.database.azure.com (Linked to VNet)                 |   |
|   |  • Encryption in Transit: require_secure_transport = ON, tls_version = TLSv1.2               |   |
|   +-----------------------------------------------------------------------------------------------+   |
+-------------------------------------------------------------------------------------------------------+
```

---

## 2. 🌐 VNet and Subnet Details

| Parameter | Configuration Value | Description |
| :--- | :--- | :--- |
| **Virtual Network** | `vnet-talenthub-prod` | Primary virtual network boundary |
| **Address Space** | `10.0.0.0/16` | 65,536 private IP addresses (RFC 1918) |
| **Frontend Subnet** | `10.0.1.0/24` (`snet-frontend`) | 251 usable Azure IPs for Reverse Proxy / Application Gateway |
| **Backend Subnet** | `10.0.2.0/24` (`snet-backend`) | 251 usable Azure IPs for Node.js Express API instances |
| **Database Subnet** | `10.0.3.0/24` (`snet-database`) | Delegated exclusively to `Microsoft.DBforMySQL/flexibleServers` |

- **Address Contiguity**: All subnets are non-overlapping, contiguous `/24` subnets.
- **Sizing Compliance**: Azure requires a minimum `/28` for MySQL Flexible Server delegated subnets; `/24` provides ample capacity for high availability (HA) standby instances and maintenance operations.

---

## 3. 🛡️ Network Security Group (NSG) Rules

### Tier 1: Frontend NSG (`nsg-talenthub-frontend`)
| Direction | Priority | Name | Protocol | Port | Source | Destination | Access |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inbound** | `100` | `allow-http-inbound` | TCP | `80` | `Internet` | `10.0.1.0/24` | **Allow** |
| **Inbound** | `110` | `allow-https-inbound` | TCP | `443` | `Internet` | `10.0.1.0/24` | **Allow** |
| **Inbound** | `120` | `allow-gateway-manager` | TCP | `65200-65535` | `GatewayManager` | `*` | **Allow** |
| **Outbound** | `100` | `allow-backend-api-outbound` | TCP | `5000` | `10.0.1.0/24` | `10.0.2.0/24` | **Allow** |
| **Outbound** | `110` | `deny-database-direct-outbound` | TCP | `3306` | `10.0.1.0/24` | `10.0.3.0/24` | **Deny** |

### Tier 2: Backend NSG (`nsg-talenthub-backend`)
| Direction | Priority | Name | Protocol | Port | Source | Destination | Access |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inbound** | `100` | `allow-frontend-to-backend-api` | TCP | `5000` | `10.0.1.0/24` | `10.0.2.0/24` | **Allow** |
| **Inbound** | `110` | `allow-azure-loadbalancer-inbound` | TCP | `5000` | `AzureLoadBalancer`| `10.0.2.0/24` | **Allow** |
| **Inbound** | `200` | `deny-direct-internet-inbound` | Any | `*` | `Internet` | `10.0.2.0/24` | **Deny** |
| **Outbound** | `100` | `allow-backend-to-database-outbound` | TCP | `3306` | `10.0.2.0/24` | `10.0.3.0/24` | **Allow** |
| **Outbound** | `110` | `allow-azure-services-outbound` | TCP | `443` | `10.0.2.0/24` | `AzureCloud` | **Allow** |
| **Outbound** | `4000`| `deny-arbitrary-internet-egress` | Any | `*` | `10.0.2.0/24` | `Internet` | **Deny** |

### Tier 3: Database NSG (`nsg-talenthub-database`)
| Direction | Priority | Name | Protocol | Port | Source | Destination | Access |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inbound** | `100` | `allow-backend-to-mysql-inbound` | TCP | `3306` | `10.0.2.0/24` | `10.0.3.0/24` | **Allow** |
| **Inbound** | `110` | `allow-azure-loadbalancer-inbound` | Any | `*` | `AzureLoadBalancer`| `10.0.3.0/24` | **Allow** |
| **Inbound** | `4096`| `deny-all-other-inbound` | Any | `*` | `*` | `*` | **Deny** |
| **Outbound** | `100` | `allow-azure-cloud-outbound` | TCP | `443` | `10.0.3.0/24` | `AzureCloud` | **Allow** |
| **Outbound** | `4096`| `deny-direct-internet-outbound` | Any | `*` | `10.0.3.0/24` | `Internet` | **Deny** |

---

## 4. 🔀 Routing Details

1. **Backend Subnet Route Table (`rt-talenthub-backend`)**:
   - Associated with `snet-backend`.
   - Isolates application outbound traffic, preserving local VNet routing to the MySQL delegated subnet while blocking unmanaged internet routing.
2. **Database Delegated Subnet Routing**:
   - Microsoft officially manages the platform routes on the delegated `Microsoft.DBforMySQL/flexibleServers` subnet.
   - User-defined routes (UDRs) with `0.0.0.0/0 -> None` are intentionally omitted from `snet-database` because Azure Flexible Server requires direct platform egress to `AzureCloud` / `AzureStorage` for automated snapshots, backups, telemetry, and OS patch management.
   - Isolation is enforced through `public_network_access_enabled = false` combined with the Database NSG rules.

---

## 5. 🔒 Security Implementation Highlights

1. **Zero Public Database Exposure**:
   - `azurerm_mysql_flexible_server.mysql.public_network_access_enabled = false`.
   - The database has no public IP address and cannot be addressed over the public internet.
2. **Private DNS Integration**:
   - `azurerm_private_dns_zone` (`privatelink.mysql.database.azure.com`) is linked to `vnet-talenthub-prod`.
   - The Node.js Express backend resolves the private MySQL FQDN directly inside the VNet.
3. **Mandatory Encryption in Transit**:
   - `require_secure_transport = ON` forces all client connections to use SSL/TLS.
   - `tls_version = TLSv1.2` blocks legacy, vulnerable TLS 1.0/1.1 protocols.
4. **Credential Safety (No Hardcoded Secrets)**:
   - All passwords and user credentials are parameterized in `variables.tf`.
   - If `mysql_admin_password` is empty, Terraform dynamically generates a high-entropy 24-character cryptographic password via `random_password` marked `sensitive = true`.
5. **Defense-in-Depth Separation**:
   - The frontend presentation tier is explicitly denied outbound port `3306` access to the database subnet.
   - The backend tier cannot be accessed directly from the public internet.

---

## 6. 🚀 Terraform Deployment Instructions

### Prerequisites
- [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) (>= 1.5.0)
- [Azure CLI (`az`)](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)

### Step 1: Log in to Azure
```bash
az login
az account set --subscription "<your-subscription-id>"
```

### Step 2: Initialize Terraform Providers
```bash
cd infrastructure/terraform
terraform init
```

### Step 3: Configure Environment Variables
```bash
cp terraform.tfvars.example terraform.tfvars
# Inspect and customize variables in terraform.tfvars
```

### Step 4: Validate Configuration Syntax
```bash
terraform validate
```

### Step 5: Review Execution Plan (Dry Run — Does NOT Deploy Resources)
```bash
terraform plan -out=tfplan
```

### Step 6: Deploy (When Approved)
```bash
terraform apply tfplan
```

### Step 7: Export Environment Variables for Backend
```bash
terraform output -raw backend_env_template
```

---

## 7. ✅ Validation Results Matrix

| Validation Check | Assessment | Status | Notes |
| :--- | :--- | :--- | :--- |
| **1. Syntax & Provider Constraints** | Validated against `azurerm` (~> 3.90) and `random` (~> 3.6) providers. | **PASSED** | Valid HCL2, arguments, and blocks verified. |
| **2. VNet & Subnet CIDR Ranges** | Non-overlapping CIDRs in RFC 1918 `10.0.0.0/16` space. | **PASSED** | `10.0.1.0/24`, `10.0.2.0/24`, `10.0.3.0/24` contiguous and sized appropriately. |
| **3. NSG Security Rules** | Least-privilege rules on Frontend, Backend, and Database tiers. | **PASSED** | Direct internet ingress to backend blocked; direct frontend-to-database access blocked; Azure health probes allowed. |
| **4. Database Network Isolation** | Private DNS Zone link, delegated subnet, no public endpoint. | **PASSED** | `public_network_access_enabled = false`, SSL ON, TLS 1.2+ enforced. |
| **5. Routing Configurations** | Route table on backend tier; platform routes preserved on MySQL delegated subnet. | **PASSED** | Avoids breaking Azure automated backup operations and control plane communication. |
| **6. Security Misconfigurations** | Checked for open egress, unauthenticated access, wildcard rules. | **PASSED** | Identified and remediated conflicting UDRs and restrictive load balancer probe rules. |
| **7. Hardcoded Credentials** | Checked all files for plaintext passwords or keys. | **PASSED** | Zero credentials committed. Automated random generation with `sensitive = true`. |
