# Events

Le bus expose `JOB_CREATED`, `JOB_STARTED`, `PROVIDER_SELECTED`, `EDITOR_SELECTED`, `TEXT_GENERATED`, `IMAGES_GENERATED`, `METADATA_GENERATED`, `PACKAGE_READY`, `PUBLISH_STARTED`, `PUBLISH_FINISHED`, `JOB_SUCCESS`, `JOB_FAILED`, ainsi que progression, logs, warnings, erreurs, queue et santé.

`DashboardNotificationService` traduit ces événements en `job-created`, `job-started`, `job-progress`, `job-log`, `job-warning`, `job-error`, `job-success`, `job-failed`, `queue-updated` et `system-health`.
