resource "google_cloud_run_v2_service" "app" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  labels   = var.labels

  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    # Theme generation runs a vision request through Claude and can take the
    # better part of a minute; the default 300s ceiling leaves ample headroom.
    timeout = "300s"

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        # CPU only while serving a request — this is a low-traffic booking site,
        # not a background worker.
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "FIRESTORE_DATABASE_ID"
        value = google_firestore_database.app.name
      }

      env {
        name  = "ASSETS_BUCKET"
        value = google_storage_bucket.assets.name
      }

      env {
        name  = "ADMIN_EMAIL"
        value = var.admin_email
      }

      # Empty unless a custom domain is configured; the app then derives the
      # OAuth redirect URI from the request itself.
      env {
        name  = "PUBLIC_BASE_URL"
        value = var.public_base_url
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      dynamic "env" {
        for_each = {
          GOOGLE_OAUTH_CLIENT_ID     = google_secret_manager_secret.app["google_client_id"].secret_id
          GOOGLE_OAUTH_CLIENT_SECRET = google_secret_manager_secret.app["google_client_secret"].secret_id
          SESSION_SECRET             = google_secret_manager_secret.app["session_secret"].secret_id
          ANTHROPIC_API_KEY          = google_secret_manager_secret.app["anthropic_api_key"].secret_id
        }

        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret = env.value
              # `latest` means adding a new secret version plus a redeploy is a
              # complete rotation, with no Terraform change needed.
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/api/healthz"
        }
        initial_delay_seconds = 3
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 6
      }

      liveness_probe {
        http_get {
          path = "/api/healthz"
        }
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.runtime,
    google_project_iam_member.runtime_firestore,
  ]
}

# The booking site is public by design; the admin portal is protected by the
# app's own Google sign-in, not by Cloud Run IAM.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_domain_mapping" "custom" {
  count = var.custom_domain == "" ? 0 : 1

  project  = var.project_id
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
    labels    = var.labels
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
