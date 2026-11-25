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
git ls-tree -r --name-only -z "$source_commit" > "$workdir/tracked-files"
while IFS= read -r -d '' path; do
  case "$path" in
    *.tfstate|*.tfstate.*|*.tfplan)
      printf 'Terraform state or plan tracked in this commit: %q\n' "$path" >&2
      exit 1
      ;;
  esac
done < "$workdir/tracked-files"
python3 -I "$workdir/scripts/validate_tf_state_topology.py"

cd "$workdir/infra/terraform/environments/dev"
export TF_DATA_DIR="$workdir/terraform-data" TF_IN_AUTOMATION=1 TF_INPUT=0
if [[ ! -s tests/foundation.tftest.hcl ]]; then
  echo 'The DEV foundation test suite is missing.' >&2
  exit 1
fi
terraform fmt -check -recursive
terraform init -backend=false -input=false -lockfile=readonly
terraform validate -no-color
terraform test -no-color

summary="DEV foundation passed for \`$source_commit\`: state isolation, configuration validation and mocked Azure plans. PREPROD promotion still requires its separate runtime and release checks."
printf '%s\n' "$summary"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf '%s\n' "$summary" >> "$GITHUB_STEP_SUMMARY"
fi
