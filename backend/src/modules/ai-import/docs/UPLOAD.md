# Upload

`POST /api/superadmin/ai-import` accepte un champ multipart `package`, un seul fichier `.zip`, avec une limite de 50 Mio par défaut. Le buffer est écrit dans `/tmp/import-XXXXXXXX/package.zip`, jamais dans un répertoire public.
