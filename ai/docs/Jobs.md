# Jobs

Un `Job` contient identité, éditeur, provider choisi, sujet, langue, priorité, état, progression, dates, durée, logs, warnings, erreurs et résultat. Son cycle est :

`PENDING → VALIDATING → SELECT_PROVIDER → SELECT_EDITOR → GENERATE → VALIDATE → GENERATE_IMAGES → GENERATE_METADATA → PACKAGE → WORKFLOW → PUBLISH → SUCCESS|FAILED`.

Les commandes pause, resume, cancel, retry et reprioritize passent par `JobManager`.
