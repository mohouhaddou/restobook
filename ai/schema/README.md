# Schémas JSON

Ce dossier contient les représentations JSON Schema Draft 2020-12 des contrats
éditoriaux sérialisables.

- `content-package.schema.json` valide le paquet complet.
- `metadata.schema.json` valide les métadonnées éditoriales.
- `seo.schema.json` valide les données SEO et sociales.
- `images.schema.json` valide la collection d’images.

Les schémas interdisent les propriétés inconnues afin de détecter les dérives
de contrat. Ils ne contiennent aucune règle métier de publication.
