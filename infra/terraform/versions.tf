terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Partially configured: the bucket is supplied at init time so the same
  # configuration can target different projects.
  #   terraform init -backend-config="bucket=<project>-booking-tfstate"
  backend "gcs" {
    prefix = "booking/app"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
