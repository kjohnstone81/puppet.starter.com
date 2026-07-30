variable "project_id" {
  type        = string
  description = "GCP project that hosts the booking platform."
}

variable "region" {
  type        = string
  description = "Region for the Terraform state bucket. Use the same region as the app."
  default     = "europe-west1"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository allowed to deploy, as \"owner/repo\"."

  validation {
    condition     = can(regex("^[^/]+/[^/]+$", var.github_repository))
    error_message = "github_repository must be in the form \"owner/repo\"."
  }
}

variable "service_name" {
  type        = string
  description = "Base name for the deployment. Must match service_name in infra/terraform."
  default     = "booking"
}

variable "state_bucket_suffix" {
  type        = string
  description = "Suffix for the Terraform state bucket name (prefixed with the project id)."
  default     = "booking-tfstate"
}

variable "deployer_account_id" {
  type        = string
  description = "Account id for the GitHub Actions deployer service account."
  default     = "github-actions-sa"
}

variable "wif_pool_id" {
  type        = string
  description = "Workload Identity Pool id."
  default     = "github-actions-pool"
}

variable "wif_provider_id" {
  type        = string
  description = "Workload Identity Pool provider id."
  default     = "github-actions-provider"
}

variable "allowed_github_ref" {
  type        = string
  description = <<-EOT
    Optional git ref that may impersonate the deployer, e.g.
    "refs/heads/main". Left empty, any ref in the repository can deploy, which
    is the usual choice when the workflow itself only triggers on main and an
    environment approval gates the apply. Set it to lock deploys to one branch.
  EOT
  default     = ""
}
