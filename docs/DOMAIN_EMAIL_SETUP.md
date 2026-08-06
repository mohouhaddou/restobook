# Ifilino — Configuration Domaine & Email (Hostinger)

> Ce guide explique comment configurer le domaine `ifilino.com` et les emails professionnels
> chez Hostinger pour un déploiement production sécurisé.

---

## 1. Enregistrements DNS de base

Se connecter sur [hpanel.hostinger.com](https://hpanel.hostinger.com) → Domaines → `ifilino.com` → Zone DNS.

### A — Pointage IP serveur

| Type | Nom | Valeur                | TTL  |
|------|-----|-----------------------|------|
| A    | @   | `<IP_SERVEUR>`        | 3600 |
| A    | www | `<IP_SERVEUR>`        | 3600 |
| A    | api | `<IP_SERVEUR>`        | 3600 |
| A    | app | `<IP_SERVEUR>`        | 3600 |
| A    | pro | `<IP_SERVEUR>`        | 3600 |
| A    | admin | `<IP_SERVEUR>`      | 3600 |

> Remplacer `<IP_SERVEUR>` par l'adresse IP publique du serveur (actuellement `91.98.138.100`).

### CNAME — Aliases www → racine

| Type  | Nom | Valeur        | TTL  |
|-------|-----|---------------|------|
| CNAME | www | ifilino.com.  | 3600 |

---

## 2. Email professionnel — MX Records

Hostinger Business Email utilise ces enregistrements (valeurs à copier depuis
**hpanel → Emails → Gérer → Configuration DNS**) :

| Type | Nom | Priorité | Valeur                          |
|------|-----|----------|---------------------------------|
| MX   | @   | 10       | `mx1.hostinger.com`             |
| MX   | @   | 20       | `mx2.hostinger.com`             |

> Vérifier les valeurs exactes dans votre tableau de bord Hostinger — elles peuvent varier.

---

## 3. SPF (anti-spam)

Ajouter un enregistrement TXT pour autoriser Hostinger à envoyer au nom de `ifilino.com` :

| Type | Nom | Valeur                                          |
|------|-----|-------------------------------------------------|
| TXT  | @   | `v=spf1 include:_spf.hostinger.com ~all`        |

---

## 4. DKIM (signature cryptographique)

Hostinger génère automatiquement une clé DKIM. La récupérer depuis :

**hpanel → Emails → ifilino.com → Configuration DNS → DKIM**

Format attendu :

| Type | Nom                          | Valeur                     |
|------|------------------------------|----------------------------|
| TXT  | `hostingermail._domainkey`   | `v=DKIM1; k=rsa; p=<CLE>` |

> Copier la valeur exacte depuis Hostinger — la clé publique est unique à votre compte.

---

## 5. DMARC (politique anti-usurpation)

| Type | Nom      | Valeur                                                                        |
|------|----------|-------------------------------------------------------------------------------|
| TXT  | _dmarc   | `v=DMARC1; p=quarantine; rua=mailto:security@ifilino.com; adkim=s; aspf=s`  |

Commencer avec `p=none` (mode monitoring) puis passer à `p=quarantine` puis `p=reject`
une fois que les emails légitimes passent correctement.

---

## 6. HTTPS — Certificat SSL

Chez Hostinger, activer **SSL gratuit Let's Encrypt** depuis :
hpanel → Hébergement → SSL.

Pour chaque sous-domaine (`app`, `api`, `pro`, `admin`) : générer un certificat
ou utiliser un certificat wildcard `*.ifilino.com`.

Sur votre serveur (si Nginx gère SSL directement) :
```bash
certbot --nginx -d ifilino.com -d www.ifilino.com -d api.ifilino.com \
        -d app.ifilino.com -d pro.ifilino.com -d admin.ifilino.com
```

---

## 7. Configuration Nginx — Sous-domaines

Exemple de configuration Nginx pour servir l'application sur `ifilino.com` :

```nginx
# Redirection www → non-www
server {
    listen 80;
    server_name www.ifilino.com;
    return 301 https://ifilino.com$request_uri;
}

# App principale
server {
    listen 443 ssl http2;
    server_name ifilino.com;

    ssl_certificate     /etc/letsencrypt/live/ifilino.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ifilino.com/privkey.pem;

    root /var/www/restobook/backend/public;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Uploads, brand
    location /uploads/ { alias /var/www/restobook/backend/uploads/; }
    location /brand/    { alias /var/www/restobook/backend/public/brand/; }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Sous-domaine API
server {
    listen 443 ssl http2;
    server_name api.ifilino.com;
    ssl_certificate     /etc/letsencrypt/live/ifilino.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ifilino.com/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 8. Adresses email à créer chez Hostinger

| Adresse                    | Usage                              |
|----------------------------|------------------------------------|
| `contact@ifilino.com`      | Contact principal (déjà créé ✅)   |
| `support@ifilino.com`      | Support client                     |
| `business@ifilino.com`     | Partenariats, B2B                  |
| `noreply@ifilino.com`      | Emails transactionnels automatiques|
| `legal@ifilino.com`        | RGPD, mentions légales             |
| `security@ifilino.com`     | Rapports de sécurité               |

Créer depuis : **hpanel → Emails → Créer un compte email**

---

## 9. Variables d'environnement à mettre à jour

Copier `backend/.env.example` → `backend/.env` et remplir :

```env
APP_URL=https://ifilino.com
API_URL=https://api.ifilino.com
SUPPORT_EMAIL=contact@ifilino.com
NOREPLY_EMAIL=noreply@ifilino.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contact@ifilino.com
SMTP_PASS=<MOT_DE_PASSE_EMAIL>
```

---

## 10. Checklist de mise en service

- [ ] Enregistrement A pointant vers l'IP serveur
- [ ] CNAME www → ifilino.com
- [ ] MX Hostinger configurés
- [ ] SPF ajouté
- [ ] DKIM activé depuis hpanel
- [ ] DMARC en mode `p=none` (monitoring)
- [ ] Certificat SSL généré (Let's Encrypt)
- [ ] Nginx rechargé : `sudo nginx -t && sudo systemctl reload nginx`
- [ ] Email test envoyé depuis `contact@ifilino.com`
- [ ] SPF/DKIM validé via [mxtoolbox.com](https://mxtoolbox.com)
- [ ] Score DMARC validé via [dmarcanalyzer.com](https://dmarcanalyzer.com)
- [ ] `ifilino.com` accessible en HTTPS
- [ ] Redirection `www.ifilino.com` → `ifilino.com` fonctionnelle

---

## 11. Architecture cible des sous-domaines

```
ifilino.com          → Landing page publique (React SPA)
app.ifilino.com      → Application client (marketplace)
pro.ifilino.com      → Espace commerçant/professionnel
admin.ifilino.com    → Back-office superadmin
api.ifilino.com      → Backend Node.js/Express (port 3000)
help.ifilino.com     → Centre d'aide (futur)
blog.ifilino.com     → Blog (futur)
status.ifilino.com   → Page statut uptime (futur)
```

> L'application actuelle est une SPA mono-déploiement. La séparation par sous-domaines
> se fera progressivement via la configuration Nginx sans modifier le code applicatif.
