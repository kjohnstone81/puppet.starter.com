locals {
  required_apis = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    # Needed for the server to read free/busy and write events on the owner's
    # calendar. Without it every calendar call fails with a 403 that reads like
    # an auth problem.
    "calendar-json.googleapis.com",
  ]
}

resource "google_project_service" "required" {
  for_each = toset(local.required_apis)

  project = var.project_id
  service = each.value

  # Disabling an API on destroy can break unrelated workloads in the same
  # project, so leave them on.
  disable_on_destroy = false
}
