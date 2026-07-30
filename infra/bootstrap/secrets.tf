/**
 * Secret containers.
 *
 * These live in bootstrap rather than the app stack for an ordering reason:
 * Cloud Run mounts each secret at version `latest`, so a container with no
 * versions makes the first revision fail to start. Creating the containers here
 * means you can add the values before the first deploy ever runs.
 *
 * Terraform manages the containers, never the values — anything passed through
 * tfvars is written to Terraform state, which lives in a bucket several people
 * can read. Add versions out of band:
 *
 *   printf '%s' "VALUE" | gcloud secrets versions add booking-session-secret \
 *     --project=PROJECT --data-file=-
 *
 * Cloud Run reads `latest`, so rotating a secret is a new version plus a
 * redeploy, with no Terraform change.
 */

locals {
  secret_ids = {
    google_client_id     = "${var.service_name}-google-oauth-client-id"
    google_client_secret = "${var.service_name}-google-oauth-client-secret"
    session_secret       = "${var.service_name}-session-secret"
    anthropic_api_key    = "${var.service_name}-anthropic-api-key"
  }
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secret_ids

  project   = var.project_id
  secret_id = each.value

  labels = {
    app        = var.service_name
    managed-by = "terraform"
  }

  replication {
    auto {}
  }

  depends_on = [google_project_service.bootstrap]
}
