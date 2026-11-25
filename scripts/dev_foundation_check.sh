#!/usr/bin/env bash
# Exercise the committed DEV foundation with the backend disabled and mocked Azure resources.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source_commit=$(git rev-parse --verify HEAD)
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
printf 'DEV foundation scenario, commit %s\n' "$source_commit"

# Include only versioned inputs, even when developers keep local tfvars or backend settings.
git archive "$source_commit" infra/terraform scripts/validate_tf_state_topology.py | tar -x -C "$workdir"
git ls-tree -r --name-only "$source_commit" > "$workdir/tracked-files"
if grep -E '\.tfstate($|\.)|\.tfplan$' "$workdir/tracked-files"; then
  echo 'Terraform state or plan files are tracked in this commit.' >&2
  exit 1
fi
python3 "$workdir/scripts/validate_tf_state_topology.py"

cd "$workdir/infra/terraform/environments/dev"
export TF_DATA_DIR="$workdir/terraform-data" TF_IN_AUTOMATION=1 TF_INPUT=0
terraform fmt -check -recursive
terraform init -backend=false -input=false -lockfile=readonly
terraform validate -no-color
terraform test -no-color -filter=tests/foundation.tftest.hcl

summary="DEV foundation passed for \`$source_commit\`: state isolation, configuration validation and mocked Azure plans. PREPROD promotion still requires its separate runtime and release checks."
printf '%s\n' "$summary"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf '%s\n' "$summary" >> "$GITHUB_STEP_SUMMARY"
fi
