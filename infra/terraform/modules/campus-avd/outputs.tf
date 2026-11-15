output "workspace_id" {
  description = "Control-plane ID, null when disabled."
  value       = var.enabled ? azurerm_virtual_desktop_workspace.campus[0].id : null
}

output "host_pool_id" {
  description = "Control-plane ID, null when disabled."
  value       = var.enabled ? azurerm_virtual_desktop_host_pool.campus[0].id : null
}

output "enabled" {
  description = "Explicit opt-in. This module is not called from any environment."
  value       = var.enabled
}
