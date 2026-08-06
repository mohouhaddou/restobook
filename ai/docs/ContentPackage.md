# ContentPackage

`ContentPackage` est le contrat canonique entre éditeurs, workflows, publisher
et intégration. Il contient identité, Markdown, sections, métadonnées, images,
SEO, workflow, version et statut.

Les références sont définies dans `types/`, validées par JSON Schema dans
`schema/` et illustrées dans `examples/`. Une évolution incompatible exige une
nouvelle version du contrat, un schéma mis à jour, des exemples pour les cinq
éditeurs et des tests de migration. Les consommateurs doivent traiter les
objets comme immuables.
