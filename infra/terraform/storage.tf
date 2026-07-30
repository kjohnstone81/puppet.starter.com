/**
 * Private bucket for uploaded logos.
 *
 * Nothing here is world-readable: the app streams the logo through
 * /api/logo using the runtime service account, so the bucket keeps
 * public access prevention enforced and the logo is served from the site's own
 * domain rather than a storage.googleapis.com URL.
 */

resource "google_storage_bucket" "assets" {
  name     = "${var.project_id}-${var.service_name}-assets"
  project  = var.project_id
  location = var.region
  labels   = var.labels

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # A logo is small and rarely replaced; keeping old versions makes an
  # accidental overwrite recoverable at negligible cost.
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.required]
}
