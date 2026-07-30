/**
 * Runtime identity for the Cloud Run service. Kept separate from the deployer
 * account so the running app has only the permissions it actually uses:
 * Firestore documents, its own assets bucket, and its four secrets.
 */

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "${var.service_name}-runtime"
  display_name = "Booking platform runtime"
  description  = "Identity the Cloud Run service runs as."

  depends_on = [google_project_service.required]
}

# Read and write documents, but not administer the database itself.
resource "google_project_iam_member" "runtime_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# Scoped to the assets bucket rather than granted project-wide.
resource "google_storage_bucket_iam_member" "runtime_assets" {
  bucket = google_storage_bucket.assets.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

# Access to each secret individually — not roles/secretmanager.secretAccessor
# across the project.
resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each = data.google_secret_manager_secret.app

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# Structured logs and error reporting from the container.
resource "google_project_iam_member" "runtime_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
