# RestoBook — Runbook Opérationnel

## 1. Démarrage / Redémarrage

```bash
# Vérifier l'état PM2
pm2 status

# Recharger le backend (zero-downtime si fork mode)
pm2 reload index --update-env

# Redémarrer complètement
pm2 restart index

# Voir les logs en temps réel
pm2 logs index --lines 100

# Processus en cluster → passer en fork pour Socket.IO
pm2 delete index
pm2 start /var/www/restobook/backend/ecosystem.config.js
```

---

## 2. Migrations de base de données

### Ordre d'exécution des migrations
```bash
# TOUJOURS depuis /var/www/restobook/backend/
cd /var/www/restobook/backend

# Migration initiale (multi-tenant)
node scripts/migrate.js

# Migration restaurant (orders, tables)
node scripts/migrate_restaurant.js

# Migration marketplace (Phase A — Next Level)
node scripts/migrate_v3.js

# Vérifier que tout est OK
node -e "require('./models').sequelize.authenticate().then(()=>console.log('✓ DB OK'))"
```

### Règles de migration
- Toutes les migrations sont **idempotentes** (IF NOT EXISTS, INSERT IGNORE)
- Ne jamais modifier une migration déjà exécutée en production
- Créer une nouvelle migration plutôt qu'amender une existante
- Documenter chaque migration dans CHANGELOG_NEXT_LEVEL.md

---

## 3. Seeders de démonstration

```bash
# Seeders de base (3 orgs, users, menus)
node backend/scripts/seed_demo.js

# Seeders marketplace (restaurants, clients, livreurs, commandes, coupons)
node backend/scripts/seed_marketplace.js

# Images plats
node backend/scripts/seed_food_images.js
```

**Comptes disponibles après seed_demo :**
| Matricule | Mot de passe | Rôle | Organisation |
|-----------|-------------|------|-------------|
| superadmin | super123 | superadmin | Global |
| owner.corp | owner123 | owner | Cantine TechCorp |
| manager.corp | manager123 | manager | Cantine TechCorp |
| EMP001 | user123 | user | Cantine TechCorp |
| owner.ecole | owner123 | owner | École Jules Ferry |
| owner.snack | owner123 | owner | Snack Le Rapide |
| manager.snack | manager123 | manager | Snack Le Rapide |

**Après seed_marketplace :**
| Matricule | Mot de passe | Rôle | Info |
|-----------|-------------|------|------|
| client1 | client123 | customer | Client démo |
| livreur1 | livreur123 | delivery | Livreur démo |
| PROMO10 | — | coupon | -10% dès 50 MAD |

---

## 4. Variables d'environnement

Fichier : `backend/.env`

```env
PORT=3000
NODE_ENV=production
DB_HOST=127.0.0.1
DB_NAME=restobook
DB_USER=restouser
DB_PASS=<mot_de_passe_db>
JWT_SECRET=<générer: openssl rand -hex 32>
PUBLIC_BASE_URL=https://votre-domaine.com
CORS_ORIGIN=https://votre-domaine.com
CUTOFF_TIME=10:30
ALLOW_CANCEL_UNTIL=10:00
ALLOW_SELF_SIGNUP=false
TZ=Africa/Casablanca
DEFAULT_THEME_PRIMARY=#EA580C
DEFAULT_THEME_ACCENT=#16A34A
```

**Générer un nouveau JWT_SECRET sécurisé :**
```bash
openssl rand -hex 32
# → coller la valeur dans .env puis : pm2 reload index --update-env
```

---

## 5. Build frontend

```bash
cd /var/www/restobook/frontend

# Build, vérification du graphe des chunks et publication sûre.
# Les assets fingerprintés sont publiés avant index.html afin qu'un navigateur
# ne puisse jamais recevoir un index qui référence un chunk encore absent.
npm run deploy:production

# Ou configurer Nginx pour servir frontend/dist/ directement
```

---

## 6. Nginx — Configuration recommandée

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Frontend (fichiers statiques Vite)
    location /restobook/ {
        alias /var/www/restobook/frontend/dist/;
        try_files $uri $uri/ /restobook/index.html;
    }

    # Backend API (proxy vers Express)
    location /restobook/api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO (WebSocket)
    location /restobook/socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/restobook/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 7. Health checks

```bash
# Backend API
curl -s http://localhost:3000/api/health | jq .

# Base de données
mysql -u restouser -p restobook -e "SELECT COUNT(*) FROM organizations;"

# PM2 status
pm2 status

# Logs erreurs récentes
pm2 logs index --err --lines 50

# Espace disque uploads
du -sh /var/www/restobook/backend/uploads/
```

---

## 8. Rôles et permissions

| Rôle | Scope | Permissions |
|------|-------|-------------|
| superadmin | Global (toutes orgs) | Tout |
| owner | Son organisation | Admin complet de l'org |
| admin | Son organisation | CRUD users, settings, menu, orders |
| manager | Son organisation | Menu, orders, stats, prep |
| staff | Son organisation | Validation scan QR, orders (statut seulement) |
| user | Son organisation | Réservation cantine, voir menu |
| customer | Aucune org liée | Commandes marketplace, historique, profil |
| delivery | Aucune org liée | Voir commandes disponibles, statuts livraison |

### Middleware disponibles
```js
const { requireAuth, requireRole, requireSuperAdmin,
        requireOrganizationAccess, orgScope } = require('../middleware/auth');

// Exemples
router.use(requireAuth);                           // Authentifié
router.use(requireAuth, requireOrganizationAccess); // Authentifié + org active
requireRole(['manager','admin','owner','superadmin']) // Rôle minimum
requireSuperAdmin                                  // SuperAdmin uniquement
orgScope(req)  // → { organization_id: X } pour les WHERE
```

---

## 9. Dépannage fréquent

### Backend ne démarre pas
```bash
pm2 logs index --lines 50
# Vérifier DB_HOST, DB_NAME, DB_USER, DB_PASS dans .env
# Vérifier que MySQL tourne : systemctl status mysql
```

### Port déjà occupé
```bash
lsof -i :3000
pm2 delete index
pm2 start ecosystem.config.js
```

### Erreur ENUM MySQL lors d'une migration
```bash
# Si ALTER TABLE MODIFY COLUMN échoue sur ENUM déjà correct :
# → Le script migrate_v3.js vérifie via INFORMATION_SCHEMA avant d'ALTER
# → Relancer le script est sûr (idempotent)
```

### Socket.IO ne fonctionne pas avec PM2 cluster
```bash
# PM2 cluster mode = plusieurs process = Socket.IO broken
# Solution : passer en fork mode (instances: 1)
# Dans ecosystem.config.js : exec_mode: 'fork', instances: 1
pm2 delete index && pm2 start ecosystem.config.js
```

### JWT expiré côté client
```bash
# Token valable 8h par défaut
# Si le JWT_SECRET change → tous les tokens invalides immédiatement
# → Les users doivent se reconnecter
```

---

## 10. Sauvegarde base de données

```bash
# Dump complet
mysqldump -u restouser -p restobook > /backup/restobook_$(date +%Y%m%d_%H%M).sql

# Restaurer
mysql -u restouser -p restobook < /backup/restobook_20260609_120000.sql

# Crontab backup quotidien
0 3 * * * mysqldump -u restouser -p'PASS' restobook | gzip > /backup/restobook_$(date +\%Y\%m\%d).sql.gz
```

---

## 11. Monitoring

```bash
# PM2 monitoring live
pm2 monit

# CPU/mémoire
pm2 status --format json | jq '.[] | {name, cpu, memory}'

# Taille logs
du -sh ~/.pm2/logs/

# Rotation logs PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

---

## 12. RBAC multi-roles

```bash
# Etendre l ENUM users.role avec les roles SaaS
cd /var/www/restobook/backend
npm run migrate:roles
```

Documentation detaillee : `docs/RBAC.md`.

---

## 13. Module Restobook Canteen

Routes dediees : `/api/canteen`.
Page frontend : `/#/canteen`.
Documentation detaillee : `docs/CANTEEN_MODULE.md`.

---




## 14. Module Restobook Restaurant SaaS

Routes dediees : `/api/restaurant-saas`.
Page frontend : `/#/restaurant-saas`.
Catalogue plats enrichi : categories, prix, images, disponibilite et ordre.
Documentation detaillee : `docs/RESTAURANT_SAAS_MODULE.md`.

---

## 15. Module IA nutritionnelle

Migration base :

```bash
cd /var/www/restobook/backend
npm run migrate:nutrition
```

Routes dediees : `/api/nutrition`.
Page frontend : `/#/nutrition-ai`.
Documentation detaillee : `docs/NUTRITION_AI_MODULE.md`.

Les resultats nutritionnels sont estimatifs et ne remplacent pas un avis medical.

---

## 16. Module satisfaction client

Migration base :

```bash
cd /var/www/restobook/backend
npm run migrate:satisfaction
```

Routes dediees : `/api/satisfaction`.
Page frontend : `/#/satisfaction`.
Documentation detaillee : `docs/SATISFACTION_MODULE.md`.
