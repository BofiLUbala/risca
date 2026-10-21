# Deploiement de l'API RISAC sur Northflank

Alternative a Render (voir `docs/DEPLOIEMENT.md`). Northflank construit le
`backend/Dockerfile` et peut heberger Postgres dans le meme projet, ce qui evite
la mise en veille du compute Neon.

Le code n'a besoin d'aucune modification : tout passe par des variables
d'environnement deja lues par `backend/src/main.ts`.

> Northflank demande une carte bancaire a la verification du compte, meme sur
> le palier gratuit. Verifier les quotas en cours sur
> https://northflank.com/pricing avant de creer les ressources.

---

## 0. Pre-requis : pousser le depot sur GitHub

Northflank deploie depuis un depot Git et redeploie a chaque `git push`.

```
git add -A
git commit -m "Configuration de deploiement"
git push -u origin main
```

Verifier avant de pousser que `git status` ne liste ni `.env`, ni
`firebase-service-account.json`, ni `uploads/`.

---

## 1. Projet

**Create new > Project**

| Champ | Valeur |
|---|---|
| Name | `risca` |
| Region | `europe-west` (Belgique) — la plus proche de l'Afrique centrale |

---

## 2. Base de donnees — addon Postgres

**Addons > Create addon > PostgreSQL**

| Champ | Valeur |
|---|---|
| Name | `risca-postgres` |
| Version | 16 |
| Plan | le plus petit disponible |

Une fois l'addon `Running`, onglet **Connection details** : copier l'URI
`postgres://...`. C'est la valeur de `DATABASE_URL`.

Deux URI sont proposees :

- **Internal** (`...addon.code.run`) — a utiliser, le trafic reste dans le projet.
- **External** — seulement pour se connecter depuis son poste (`psql`, Prisma Studio).

Prisma a besoin de TLS sur l'URI externe : y ajouter `?sslmode=require`.

---

## 3. API — service combine

**Create new > Service > Combined service** (build + deploiement en un objet).

### Source

| Champ | Valeur |
|---|---|
| Repository | le depot `risca` |
| Branch | `main` |
| Build context | `/backend` |

### Build

| Champ | Valeur |
|---|---|
| Build type | **Dockerfile** |
| Dockerfile path | `/backend/Dockerfile` |

Ne pas choisir Buildpack : le Dockerfile gere la compilation native d'`argon2`
et le `prisma generate`, qu'un buildpack ne ferait pas.

### Networking

| Champ | Valeur |
|---|---|
| Port | `4000` |
| Protocol | `HTTP` |
| Publicly exposed | oui |

Northflank attribue alors une URL `https://<service>--<projet>.code.run`.
Le conteneur ecoute sur `PORT`, avec 4000 comme repli (`backend/src/main.ts`).

### Health check

| Champ | Valeur |
|---|---|
| Type | `HTTP` |
| Path | `/api/health` |
| Port | `4000` |

La sonde est publique (`backend/src/health.controller.ts`) et n'expose aucune
donnee metier.

### Resources

Le build compile `argon2` et TypeScript : prevoir au moins **1 Go de RAM** pour
le build, sinon `npm run build` est tue (OOM, code 137). Le runtime tient dans
512 Mo.

---

## 4. Variables d'environnement

**Service > Environment**, ou mieux : **Project > Secrets > Create secret group**
lie au service, pour partager les secrets entre services.

Le groupe accepte un collage au format `.env` : partir de
`backend/.env.northflank.example`.

| Variable | Valeur | Obligatoire |
|---|---|---|
| `DATABASE_URL` | URI interne de l'addon (etape 2) | oui |
| `JWT_SECRET` | 64 caracteres aleatoires — `openssl rand -hex 32` | oui |
| `APP_WEB_URL` | `https://<votre-app>.vercel.app` | oui |
| `CORS_ORIGINS` | `https://<votre-app>.vercel.app` | oui |
| `NODE_ENV` | `production` | deja dans l'image |
| `PORT` | `4000` | deja dans l'image |
| `JWT_EXPIRES_IN` | `30m` | defaut applicatif |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | defaut applicatif |
| `UPLOAD_DIR` | `./uploads` | defaut applicatif |
| `PLATFORM_FEE_PERCENT` | `5` | regle metier |
| `PROJECT_APPROVAL_THRESHOLD_USD` | `1000` | regle metier |
| `VALIDATION_ESCALATION_HOURS` | `72` | regle metier |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | compte e-mail (Gmail : mot de passe d'application) | pour les codes OTP |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | compte de service Firebase | optionnel, sans quoi aucun push n'est envoye |

`FIREBASE_PRIVATE_KEY` tient sur une seule ligne, les retours a la ligne
echappes en `\n`.

Les jetons de rafraichissement sont des valeurs aleatoires stockees hachees :
`JWT_SECRET` est le seul secret de signature a fournir.

---

## 5. Premier demarrage

Au lancement, le conteneur execute `prisma db push` : le schema est cree dans
la base vide, puis l'API demarre. Verifier dans **Logs** :

```
RISAC API en ecoute sur http://localhost:4000/api
```

Puis depuis un navigateur :

- `https://<service>--<projet>.code.run/api/health` → `{"status":"ok",...}`
- `https://<service>--<projet>.code.run/api/docs` → Swagger

### Peupler la base (jeu de donnees de demonstration)

Le seed est un script TypeScript, absent de l'image de production (les
dependances de dev sont elaguees). Le lancer depuis son poste avec l'URI
**externe** de l'addon :

```
cd backend
DATABASE_URL="postgres://...?sslmode=require" npm run seed
```

---

## 6. Points d'attention

**Les uploads sont ephemeres.** Le conteneur ecrit dans `/app/uploads`, perdu a
chaque redeploiement. Pour conserver les pieces jointes, attacher un
**Volume** au service (fonction payante chez Northflank) monte sur
`/app/uploads`, ou basculer le stockage vers un service objet. Tant que ce
n'est pas fait, considerer les fichiers televerses comme perdables.

**`db push` et non `migrate deploy`.** Le projet n'a pas encore de dossier
`prisma/migrations`. `db push` aligne la base sur le schema sans historique :
acceptable avant la mise en production, risque de perte de donnees ensuite.
Des qu'un historique existera, remplacer la commande dans le `CMD` du
Dockerfile par `prisma migrate deploy`.

**Redeploiement automatique.** Northflank reconstruit a chaque push sur `main`.
Desactivable dans **Service > Settings > CI**.

**Front et mobile.** Le front Next.js reste sur Vercel (voir
`docs/DEPLOIEMENT.md`), avec `NEXT_PUBLIC_API_URL` pointe sur l'URL `.code.run`.
