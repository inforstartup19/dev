variable "enabled" {
  description = "Explicit opt-in only; false by default. Must not be wired to Azure DEV without approval."
  type        = bool
  default     = false
}

variable "resource_group_name" {
  description = "Pre-approved existing resource group; this module does not create it."
  type        = string
}

variable "location" {
  description = "Azure region for the AVD control-plane resources."
  type        = string
}

variable "name_prefix" {
  description = "Lowercase unique prefix scoped to one campus/lab/environment."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,17}$", var.name_prefix))
    error_message = "Use a 3–18 character lowercase prefix starting with a letter."
  }
}

variable "max_sessions_per_host" {
  description = "A policy decision; define the AVD session concurrency cap before enabling."
  type        = number
  default     = 4

  validation {
    condition     = var.max_sessions_per_host >= 1 && var.max_sessions_per_host <= 16
    error_message = "Limit each host to 1–16 concurrent sessions, subject to sizing."
  }
}

variable "tags" {
  description = "No user identifiers or personal data in Azure resource tags."
  type        = map(string)
  default     = {}
}
