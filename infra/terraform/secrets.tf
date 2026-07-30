/**
 * Secret containers only — Terraform does not manage the values.
 *
 * Putting secret material in tfvars would write it into Terraform state, which
 * lives in a bucket several people can read. Add versions out of band instead:
 *
 *   printf '%s' "$VALUE" | gcloud secrets versions add booking-session-secret \
 *     --project=<project> --data-file=-
 *
 * Cloud Run reads `latest`, so adding a new version and redeploying rotates a
 * secret with no Terraform change.
 */

locals {
  secret_ids = {
    session_secret       = "${var.service_name}-session-secret"
    google_client_secret = "${var.service_name}-google-oauth-client-secret"
    anthropic_api_key    = "${var.service_name}-anthropic-api-key"
    google_client_id     = "${var.service_name}-google-oauth-client-id"
  }
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secret_ids

  project   = var.project_id
  secret_id = each.value
  labels    = var.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}
