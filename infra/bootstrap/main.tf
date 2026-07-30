/**
 * Bootstrap — run this ONCE, locally, with an account that can administer the
 * project. It creates the things CI cannot create for itself:
 *
 *   - the GCS bucket holding Terraform state for the main stack
 *   - the deployer service account GitHub Actions impersonates
 *   - the Workload Identity Federation pool that lets GitHub mint tokens for
 *     that account without a downloadable JSON key
 *
 * Everything else lives in ../terraform and is managed by CI.
 *
 *   terraform -chdir=infra/bootstrap init
 *   terraform -chdir=infra/bootstrap apply -var project_id=... -var github_repository=owner/repo
 */

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_project" "this" {
  project_id = var.project_id
}

# APIs the bootstrap itself depends on. The main stack enables the rest.
resource "google_project_service" "bootstrap" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  # Leave APIs enabled if this stack is ever destroyed — disabling them would
  # take down anything else in the project that depends on them.
  disable_on_destroy = false
}

/* ------------------------------------------------------------ state bucket */

resource "google_storage_bucket" "tfstate" {
  name     = "${var.project_id}-${var.state_bucket_suffix}"
  project  = var.project_id
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # State is the record of what exists; keep old versions so a bad apply is
  # recoverable.
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 20
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.bootstrap]
}

/* --------------------------------------------------------- deployer account */

resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = var.deployer_account_id
  display_name = "GitHub Actions deployer (booking platform)"
  description  = "Impersonated by GitHub Actions via Workload Identity Federation to run Terraform."

  depends_on = [google_project_service.bootstrap]
}

# Roles the deployer needs to manage the main stack. Broad by necessity —
# Terraform creates service accounts, IAM bindings, secrets, and Cloud Run
# services — but scoped to this one project.
resource "google_project_iam_member" "deployer" {
  for_each = toset([
    "roles/run.admin",
    "roles/artifactregistry.admin",
    "roles/storage.admin",
    "roles/secretmanager.admin",
    "roles/datastore.owner",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/resourcemanager.projectIamAdmin",
    "roles/serviceusage.serviceUsageAdmin",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_storage_bucket_iam_member" "deployer_state" {
  bucket = google_storage_bucket.tfstate.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.deployer.email}"
}

/* --------------------------------------------- workload identity federation */

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = var.wif_pool_id
  display_name              = "GitHub Actions"
  description               = "Federated identities for GitHub Actions workflows."

  depends_on = [google_project_service.bootstrap]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = var.wif_provider_id
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Without this condition any GitHub repository in the world could mint tokens
  # for this pool. It restricts the provider to the one repository.
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Only workflows running in the named repository may impersonate the deployer.
resource "google_service_account_iam_member" "github_impersonation" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
