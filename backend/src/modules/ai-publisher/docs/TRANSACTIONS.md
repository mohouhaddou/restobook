# Transactions et rollback

La détection de doublon précède toute copie. Les écritures d'article sont effectuées dans une transaction Sequelize. Une erreur avant commit déclenche le rollback SQL et la suppression compensatoire de chaque image déjà copiée. Après commit, `PUBLISH_COMPLETED` notifie AI Import, qui reste seul responsable de supprimer le ZIP et son workspace temporaire.
