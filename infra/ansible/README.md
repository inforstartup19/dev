# Inc Campus Ansible — configuration layer (proposal)

**Safe starting point:** Ansible inventory and policy-only validation playbook. It operates **on localhost only**, makes no cloud calls, and does not install applications or reconfigure devices.

- Terraform owns infrastructure and desired resources.
- Image Builder/Packer will create ephemeral lab VM images (future).
- Ansible will own idempotent OS packages, teaching tools, hardening and smoke checks, through a controlled image pipeline (future).
- Lab Broker will handle consent, identity, quotas, TTL, approval and deprovisioning (future); browser will never execute Ansible or Terraform.
- Do not commit credentials, Windows local admin passwords, cloud registration tokens, real endpoints, or student PII. Use approved secret stores and scoped identities only.

Local checks once Ansible is installed:

```bash
cd infra/ansible
ansible-playbook --syntax-check playbooks/validate-lab-host.yml
ansible-playbook playbooks/validate-lab-host.yml
```

Follow `docs/architecture/terraform-ansible-campus-labs.md`. No direct provisioning/guest access until policy, cost and tenant isolation are approved.
