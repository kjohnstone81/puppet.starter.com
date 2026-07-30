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
