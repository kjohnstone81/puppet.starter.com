/**
 * The secret containers are created by infra/bootstrap and referenced here.
 *
 * Cloud Run mounts each secret at version `latest`, so a container with no
 * versions would make the first revision fail to start. Creating them in
 * bootstrap means the values can be added before the first deploy runs, and a
 * missing secret fails at plan time with a clear "not found" rather than
 * halfway through an apply.
 */

locals {
  secret_ids = {
    google_client_id     = "${var.service_name}-google-oauth-client-id"
    google_client_secret = "${var.service_name}-google-oauth-client-secret"
    session_secret       = "${var.service_name}-session-secret"
    anthropic_api_key    = "${var.service_name}-anthropic-api-key"
  }
}

data "google_secret_manager_secret" "app" {
  for_each = local.secret_ids

  project   = var.project_id
  secret_id = each.value
}
