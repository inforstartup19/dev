# Terraform state ownership — proposal only (#62)

**No Azure service has been provisioned by this file.** The existing dev Terraform source still uses its prior backend configuration; this manifest does not change any state backend, key, identity, resource or `terraform apply`.

| Scope | Terraform state key | Status |
| --- | --- | --- |
| Current platform DEV | `dev/terraform.tfstate` | Declared in existing DEV backend example, cloud state not verified |
| Future Campus control plane | `campus/control-plane/dev/terraform.tfstate` | Proposal only; no backend/resource group/storage provisioned |
| Future Campus Labs | `campus/labs/dev/terraform.tfstate` | Proposal only; no backend/resource group/storage provisioned |

## Separation rules

- Every scope gets its own state key, OIDC workload identity and least-privilege deployment permissions; separate storage accounts/subscriptions may be required by institution or environment after a security and cost review.
- Immutable build artifacts promoted DEV → PREPROD → PROD, with distinct secrets, resource groups, subnet ranges and PostgreSQL instances **only after** #49 approval.
- Terraform owns cloud resources; Ansible owns configuration of signed ephemeral machine images, never cloud credentials from the browser.
- The University Lab Broker is a separate authorization service. It must never run `terraform apply` from an arbitrary student request.
- No credentials, actual state files, plans, user identity or university enrollment IDs in Git.
- Before migration of any real state: discover the live backend, snapshot/backup, enumerate resources, obtain approval, run `state mv` or `moved` safely in a controlled maintenance window and compare plan with zero unintended destroys. **No automatic migration.**
- Keep the current manual `terraform-plan`/`terraform-apply` workflows gated to `main` until #49 resolves Git branch vs Azure environment trust/RBAC.

CI runs `python3 scripts/validate_tf_state_topology.py` with no Azure credentials. This validates only the **planning contract**, not a deployed or operational state backend.
