# Deploiement RISAC — hebergement gratuit

Cible : **Neon** (Postgres) + **Render** (API NestJS) + **Vercel** (front Next.js).
Aucune carte bancaire requise sur les trois.

Le code n'a besoin d'aucune modification : tout passe par des variables
d'environnement deja lues par `backend/src/main.ts` et `frontend/src/lib/api.ts`.

---

## 0. Pre-requis : pousser le depot sur GitHub

Render et Vercel deploient depuis un depot Git. Le depot local n'a encore
aucun commit.

```
git add -A
git commit -m "Configuration de deploiement"
git branch -M main
git remote add origin https://github.com/<votre-compte>/risca.git
git push -u origin main
```

Verifier avant de pousser que `git status` ne liste ni `.env`, ni
`firebase-service-account.json`, ni `uploads/` — ils sont deja couverts par
`.gitignore`.

---

## 1. Base de donnees — Neon

1. Creer un compte sur https://neon.com, puis un projet (region Europe).
2. Copier la chaine de connexion, format :
   `postgresql://user:motdepasse@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. La conserver : c'est la valeur de `DATABASE_URL` a l'etape suivante.

Limites du plan gratuit : 1 Go de stockage par projet, 100 CU-heures/mois,
**le compute se met en veille apres 5 minutes d'inactivite** (la premiere
requete apres une pause prend 1 a 3 secondes).

---

## 2. API — Render

1. Compte sur https://render.com, puis **New > Blueprint**, choisir le depot.
   Render lit `render.yaml` a la racine et cree le service `risac-api`.
2. Renseigner les variables marquees `sync: false` :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | la chaine Neon de l'etape 1 |
   | `APP_WEB_URL` | `https://<votre-app>.vercel.app` |
   | `CORS_ORIGINS` | `https://<votre-app>.vercel.app` |
   | `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | compte e-mail (Gmail : mot de passe d'application) |
   | `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | compte de service Firebase, cle privee sur une seule ligne avec les `\n` echappes |

   `JWT_SECRET` est genere automatiquement par Render (les jetons de rafraichissement
   sont des valeurs aleatoires stockees hachees : aucun second secret n'est necessaire).

3. Au premier demarrage, le conteneur execute `prisma db push` : le schema est
   cree dans Neon.
4. Verifier : `https://risac-api.onrender.com/api/health` doit renvoyer
   `{"status":"ok",...}`. La documentation Swagger est sur `/api/docs`.

### Peupler la base (jeu de donnees de demonstration)

Depuis votre machine, en pointant sur Neon :

```
cd backend
DATABASE_URL="<chaine Neon>" npm run seed
```

---

## 3. Front — Vercel

1. Compte sur https://vercel.com, **Add New > Project**, choisir le depot.
2. **Root Directory** : `frontend`. Le reste est detecte automatiquement
   (Next.js 15).
3. Variables d'environnement :

   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://risac-api.onrender.com/api` |
   | `NEXT_PUBLIC_API_ORIGIN` | `https://risac-api.onrender.com` |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | console Firebase > Parametres > Vos applications |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | idem |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | idem |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | idem |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | idem |
   | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Cloud Messaging > Certificats Web Push |

4. Deployer, puis revenir sur Render corriger `APP_WEB_URL` et `CORS_ORIGINS`
   avec l'URL Vercel definitive, et redeployer l'API.

---

## 4. Contraintes du plan gratuit — a connaitre

**Mise en veille de l'API.** Le service Render free s'arrete apres 15 minutes
sans trafic ; le reveil prend environ une minute, pendant laquelle les appels
peuvent expirer.

Consequence directe sur les taches planifiees (`@nestjs/schedule`) : elles ne
tournent pas pendant la veille. Sont concernes les prelevements recurrents de
parrainage (`runRecurringCharges` dans `payments.service.ts`) et l'escalade des
validations a 72 h.

Contournement pour une phase d'essai : un ping gratuit toutes les 10 minutes
sur `/api/health` depuis https://cron-job.org. Attention, le quota est de
750 heures/mois, soit tout juste un seul service maintenu eveille en continu
(~720 h).

**Fichiers uploades ephemeres.** `UPLOAD_DIR` pointe vers le disque du
conteneur : tout redeploiement ou redemarrage efface les fichiers. Acceptable
pour une demonstration. Pour conserver les fichiers, basculer l'upload vers un
stockage objet (Supabase Storage 1 Go gratuit, ou Cloudflare R2 10 Go).

**Redis.** Declare dans `docker-compose.yml` mais jamais utilise dans le code :
aucun hebergement Redis n'est a prevoir.

**Postgres de Render : a ne pas utiliser.** L'instance gratuite expire au bout
de 30 jours, d'ou le choix de Neon.

---

## 5. Mobile (Expo)

L'application mobile n'est pas hebergee : elle se construit via EAS.
Pointer `EXPO_PUBLIC_API_URL` sur l'URL Render, puis `eas build`.
Le plan gratuit EAS inclut un nombre limite de builds par mois.

---

## 6. Alternatives a Render

- **Railway** — 5 $ de credit d'essai sur 30 jours, puis 1 $/mois ; pas de
  mise en veille pendant l'essai.
- **Zeabur** — plan gratuit avec auto-sleep, deploiement Docker direct.
- **Oracle Cloud Always Free** — VM ARM gratuite a vie, reellement 24/7, mais
  carte bancaire exigee et installation manuelle (Docker, Nginx, Certbot).
- **Fly.io et Koyeb** : plus de plan gratuit reel, a ecarter.
