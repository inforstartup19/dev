# Control plane only: no session hosts, network access, users, registration
# tokens, application binaries or desktop entitlements are created here.
# Disabled by default. Approval for enabling is required by issue #49.
resource "azurerm_virtual_desktop_workspace" "campus" {
  count               = var.enabled ? 1 : 0
  name                = "${var.name_prefix}-workspace"
  resource_group_name = var.resource_group_name
  location            = var.location
  friendly_name       = "Inc Campus pilot workspace"
  tags                = var.tags
}

resource "azurerm_virtual_desktop_host_pool" "campus" {
  count                    = var.enabled ? 1 : 0
  name                     = "${var.name_prefix}-pool"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  type                     = "Pooled"
  load_balancer_type       = "BreadthFirst"
  maximum_sessions_allowed = var.max_sessions_per_host
  description              = "Control plane only; no session hosts provisioned"
  tags                     = var.tags
}

resource "azurerm_virtual_desktop_application_group" "campus" {
  count               = var.enabled ? 1 : 0
  name                = "${var.name_prefix}-desktop"
  resource_group_name = var.resource_group_name
  location            = var.location
  host_pool_id        = azurerm_virtual_desktop_host_pool.campus[0].id
  type                = "Desktop"
  tags                = var.tags
}

resource "azurerm_virtual_desktop_workspace_application_group_association" "campus" {
  count                = var.enabled ? 1 : 0
  workspace_id         = azurerm_virtual_desktop_workspace.campus[0].id
  application_group_id = azurerm_virtual_desktop_application_group.campus[0].id
}
