# Inc Campus AVD — dormant control-plane module

This is a **disabled-by-default, unreferenced** Terraform module. It is **not** a working VDI service: no session hosts, VM image, AD/Entra join, storage, FSLogix, users, roles, remote access or scaling is configured.

## Example (NOT attached to `environments/dev`)

```hcl
module "campus_avd" {
  source                  = "../../modules/campus-avd"
  enabled                 = false
  resource_group_name     = "rg-incfs-campus-approved"
  location                = "francecentral"
  name_prefix             = "incfs-uni-lab"
  max_sessions_per_host   = 4
  tags                    = { environment = "dev", platform = "inc-campus" }
}
```

Before **ever** setting `enabled=true`, follow `docs/architecture/terraform-ansible-campus-labs.md` and approve network isolation, quota, subscription, pricing, licensing, host pool join strategy, rollback, user assignment and lifecycle. No deployment is authorized by committing this module.
