resource "google_artifact_registry_repository" "app" {
  project       = var.project_id
  location      = var.region
  repository_id = "${var.service_name}-images"
  description   = "Container images for the booking platform."
  format        = "DOCKER"
  labels        = var.labels

  # Keep the last handful of images for rollback; drop the rest so storage
  # doesn't grow without bound.
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  depends_on = [google_project_service.required]
}
