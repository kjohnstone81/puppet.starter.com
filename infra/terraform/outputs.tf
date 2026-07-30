output "service_url" {
  description = "Public URL of the booking site."
  value       = google_cloud_run_v2_service.app.uri
}

output "oauth_redirect_uri" {
  description = "Add this exact value to the OAuth client's authorised redirect URIs in the Google Cloud console."
  value       = "${var.custom_domain == "" ? google_cloud_run_v2_service.app.uri : "https://${var.custom_domain}"}/api/auth/callback"
}

output "artifact_registry_repository" {
  description = "Docker repository CI pushes images to."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "assets_bucket" {
  description = "Bucket holding uploaded logos."
  value       = google_storage_bucket.assets.name
}

output "runtime_service_account" {
  description = "Identity the Cloud Run service runs as."
  value       = google_service_account.runtime.email
}

output "secret_ids" {
  description = "Secret Manager secrets to populate with `gcloud secrets versions add`."
  value       = { for k, v in google_secret_manager_secret.app : k => v.secret_id }
}
