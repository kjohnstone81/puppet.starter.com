output "tfstate_bucket" {
  description = "Set this as the TF_STATE_BUCKET GitHub Actions variable."
  value       = google_storage_bucket.tfstate.name
}

output "deployer_service_account" {
  description = "Set this as the GCP_DEPLOYER_SA GitHub Actions variable."
  value       = google_service_account.deployer.email
}

output "workload_identity_provider" {
  description = "Set this as the GCP_WORKLOAD_IDENTITY_PROVIDER GitHub Actions variable."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_actions_variables" {
  description = "Copy-paste summary of the repository variables to configure."
  value = join("\n", [
    "GCP_PROJECT_ID=${var.project_id}",
    "GCP_REGION=${var.region}",
    "TF_STATE_BUCKET=${google_storage_bucket.tfstate.name}",
    "GCP_DEPLOYER_SA=${google_service_account.deployer.email}",
    "GCP_WORKLOAD_IDENTITY_PROVIDER=${google_iam_workload_identity_pool_provider.github.name}",
  ])
}

output "next_steps" {
  description = "Commands to run before the first deploy. The secrets have containers but no values yet."

  value = <<-EOT
    Add a value to each secret — Cloud Run reads `latest`, and a secret with no
    version makes the first revision fail to start.

      printf '%s' "YOUR_CLIENT_ID.apps.googleusercontent.com" \
        | gcloud secrets versions add ${google_secret_manager_secret.app["google_client_id"].secret_id} --project=${var.project_id} --data-file=-

      printf '%s' "GOCSPX-your-client-secret" \
        | gcloud secrets versions add ${google_secret_manager_secret.app["google_client_secret"].secret_id} --project=${var.project_id} --data-file=-

      openssl rand -base64 48 \
        | gcloud secrets versions add ${google_secret_manager_secret.app["session_secret"].secret_id} --project=${var.project_id} --data-file=-

      printf '%s' "sk-ant-your-key" \
        | gcloud secrets versions add ${google_secret_manager_secret.app["anthropic_api_key"].secret_id} --project=${var.project_id} --data-file=-

    Verify all four have a version before deploying:

      gcloud secrets list --project=${var.project_id} --filter="name~${var.service_name}-" --format="table(name)"
  EOT
}

output "auth_step_yaml" {
  description = <<-EOT
    The authenticate step with real values substituted, for pasting into any
    workflow that needs GCP access. The repository workflows read these from
    repository variables instead, so they need no edit.
  EOT

  value = <<-EOT
    - name: Authenticate to Google Cloud
      uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: '${google_iam_workload_identity_pool_provider.github.name}'
        service_account: '${google_service_account.deployer.email}'
  EOT
}
