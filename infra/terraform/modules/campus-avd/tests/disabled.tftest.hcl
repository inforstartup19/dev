mock_provider "azurerm" {}

variables {
  resource_group_name = "rg-incfs-test-no-deploy"
  location            = "francecentral"
  name_prefix         = "incfsuni"
}

run "campus_avd_is_disabled_by_default" {
  command = plan

  assert {
    condition = (
      !var.enabled &&
      length(azurerm_virtual_desktop_workspace.campus) == 0 &&
      length(azurerm_virtual_desktop_host_pool.campus) == 0 &&
      length(azurerm_virtual_desktop_application_group.campus) == 0
    )
    error_message = "No campus desktop resources should be planned without an explicit approval."
  }
}

run "reject_unsafe_prefix" {
  command = plan
  variables { name_prefix = "INVALID name!" }
  expect_failures = [var.name_prefix]
}
