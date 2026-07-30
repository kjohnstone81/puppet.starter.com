resource "google_firestore_database" "app" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  # Bookings are the business's records — recover them if something goes wrong.
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"

  # Guard against an accidental `terraform destroy` taking every booking with
  # it. Removing a Firestore database is not something to do by accident.
  delete_protection_state = "DELETE_PROTECTION_ENABLED"

  # The location is immutable; without ignore_changes, editing the variable
  # would make Terraform propose replacing the database and losing all data.
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [location_id]
  }

  depends_on = [google_project_service.required]
}

# No composite indexes are declared: every query the app issues filters and
# orders on `startsAt` alone, which Firestore's automatic single-field indexes
# already cover. Status is filtered in application code precisely so a second
# index isn't needed.
