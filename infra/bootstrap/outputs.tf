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
