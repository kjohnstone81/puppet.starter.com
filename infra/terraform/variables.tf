variable "project_id" {
  type        = string
  description = "GCP project that hosts the booking platform."
}

variable "region" {
  type        = string
  description = "Region for Cloud Run, Artifact Registry, and the assets bucket."
  default     = "europe-west1"
}

variable "firestore_location" {
  type        = string
  description = <<-EOT
    Firestore location. This is fixed for the life of the database — it cannot
    be changed later without creating a new one. Multi-region values are "eur3"
    or "nam5"; a plain region such as "europe-west1" also works.
  EOT
  default     = "eur3"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name."
  default     = "booking"
}

variable "image" {
  type        = string
  description = <<-EOT
    Fully qualified container image to deploy, ideally pinned by digest. CI
    passes the image it just built and pushed.
  EOT
}

variable "admin_email" {
  type        = string
  description = "Google account allowed to sign in to /admin and whose calendar is booked."

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.admin_email))
    error_message = "admin_email must be a valid email address."
  }
}

variable "public_base_url" {
  type        = string
  description = <<-EOT
    Only set when serving from a custom domain. Left empty, the app derives the
    OAuth redirect URI from the incoming request, so the Cloud Run URL works
    with no further configuration.
  EOT
  default     = ""
}

variable "min_instances" {
  type        = number
  description = "Minimum Cloud Run instances. 0 scales to nothing when idle; 1 removes cold starts."
  default     = 0
}

variable "max_instances" {
  type        = number
  description = "Maximum Cloud Run instances — the ceiling on both load and spend."
  default     = 10
}

variable "cpu" {
  type        = string
  description = "CPU allocation per instance."
  default     = "1"
}

variable "memory" {
  type        = string
  description = "Memory allocation per instance."
  default     = "512Mi"
}

variable "custom_domain" {
  type        = string
  description = <<-EOT
    Optional custom domain to map to the service. Requires the domain to be
    verified in Google Search Console for the deploying account, and Cloud Run
    domain mapping to be available in the region.
  EOT
  default     = ""
}

variable "labels" {
  type        = map(string)
  description = "Labels applied to resources that support them."
  default = {
    app        = "booking"
    managed-by = "terraform"
  }
}
