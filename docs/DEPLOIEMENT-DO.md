# Deploiement RISAC — DigitalOcean + Cloudflare + Google Play

| Element | Hebergement | Outil |
|---|---|---|
| API + base Postgres + fichiers | Droplet DigitalOcean (Frankfurt) | `infra/do/deploy.sh` |
| Application web | Cloudflare Workers (OpenNext) | `npm run cf:deploy` |
| Application mobile | Google Play Console | EAS Build |

Remplace l'ancienne cible Render/Neon/Vercel de `DEPLOIEMENT.md` (les fichiers
`render.yaml` et le workflow Northflank restent en place, inutilises).

---

## 1. API sur le droplet

Pre-requis : un droplet Ubuntu 24.04 (2 Go de RAM minimum) cree avec la cle SSH
`~/.ssh/risac_do`, et son adresse IP.

```bash
SERVER=root@<IP> bash infra/do/deploy.sh
```

Le script, relancable a volonte :

1. se connecte avec `~/.ssh/risac_do` ;
2. prepare le serveur la premiere fois (`bootstrap.sh`) : Docker, swap 2 Go,
   pare-feu (SSH, 80, 443), connexion SSH par cle uniquement, fail2ban, mises a
   jour de securite automatiques ;
3. envoie le code de `backend/` et la configuration de `infra/do/` ;
4. cree `/opt/risac/.env` avec des secrets aleatoires **une seule fois** ;
5. construit l'image, demarre Postgres, l'API et Caddy, puis attend que l'API
   soit saine ;
6. installe la sauvegarde quotidienne de la base (02:30).

Test sans domaine (HTTP simple, pour verifier seulement) :

```bash
curl http://<IP>/api/health
```

### Domaine et HTTPS

Les applications mobiles de production refusent le HTTP : un domaine est
obligatoire avant la publication.

1. Dans Cloudflare > DNS, creer un enregistrement **A** `api` -> IP du droplet.
   Laisser le nuage **gris** (DNS seul) pour que Caddy obtienne son certificat.
2. Relancer avec le domaine :
   ```bash
   SERVER=root@<IP> API_DOMAIN=api.exemple.org WEB_URL=https://app.exemple.org bash infra/do/deploy.sh
   ```
3. Verifier `https://api.exemple.org/api/health`. Le nuage peut ensuite passer a
   l'orange si le mode SSL de Cloudflare est **Full (strict)**.

### Premier compte Super Admin

Aucune donnee de demonstration n'est chargee en production (le mot de passe
commun des comptes de demonstration est public dans le README : ne jamais
lancer `npm run seed` sur ce serveur). Le Super Admin se cree sur `/admin` du
site web, avec la cle d'installation :

```bash
ssh -i ~/.ssh/risac_do root@<IP> "grep ADMIN_SETUP_KEY /opt/risac/.env"
```

### Secrets a completer

`ssh -i ~/.ssh/risac_do root@<IP>`, puis `nano /opt/risac/.env` et
`cd /opt/risac && docker compose up -d` : SMTP (codes OTP par e-mail),
Firebase (push), passerelles de paiement. Sans SMTP, l'activation des comptes
par e-mail ne fonctionne pas.

### Exploitation

```bash
cd /opt/risac
docker compose ps
docker compose logs -f api
./backup.sh                      # sauvegarde immediate
# Restauration d'une sauvegarde :
gunzip -c backups/risac-AAAA-MM-JJ.sql.gz | docker compose exec -T postgres psql -U risac risac
```

Les sauvegardes restent sur le disque du droplet : activer les sauvegardes
DigitalOcean (panneau du droplet) ou copier `/opt/risac/backups` ailleurs.

---

## 2. Application web sur Cloudflare

L'application a des pages dynamiques (`/enfants/[id]`, `/projets/[id]`...) : un
export statique est impossible, d'ou OpenNext sur Workers. Le Worker pese
environ 1,7 Mo compresse, sous la limite du plan gratuit (3 Mo).

```bash
cd frontend
npx wrangler login          # ouvre le navigateur : connexion a votre compte Cloudflare
NEXT_PUBLIC_API_URL=https://api.exemple.org/api \
NEXT_PUBLIC_API_ORIGIN=https://api.exemple.org \
NEXT_PUBLIC_WS_URL=https://api.exemple.org \
npm run cf:deploy
```

Les variables `NEXT_PUBLIC_*` sont figees dans le build : toute modification
demande de relancer la commande. Ajouter aussi les six variables
`NEXT_PUBLIC_FIREBASE_*` si les notifications web sont utilisees.

Domaine personnalise : Cloudflare > Workers & Pages > `risac-web` > Settings >
Domains & Routes > Add > `app.exemple.org` (le domaine doit etre gere par
Cloudflare). Puis relancer le deploiement de l'API avec `WEB_URL` pour que le
CORS et les liens des e-mails pointent sur ce site.

---

## 3. Application mobile sur Google Play

Pre-requis : compte developpeur Google Play (frais uniques), compte Expo.

1. Dans `mobile/eas.json`, remplacer les deux `EXPO_PUBLIC_API_URL` par
   `https://api.exemple.org/api` (profils `preview` et `production`).
2. ```bash
   cd mobile
   eas login
   eas build --platform android --profile production
   ```
   EAS genere et conserve la cle de signature ; il produit un fichier `.aab`.
3. Play Console > creer l'application (nom RISAC, identifiant `org.risac.app`) >
   Tests > Test interne (ou ferme) > Creer une version > televerser le `.aab`.
   **La premiere version se televerse a la main** : l'envoi automatique par
   `eas submit` et par `.github/workflows/mobile-alpha.yml` ne fonctionne qu'apres.
4. Remplir les rubriques obligatoires de la Play Console : politique de
   confidentialite (URL publique), securite des donnees, classification du
   contenu, public cible. L'application traite des donnees d'enfants : le
   formulaire de securite des donnees doit etre rempli avec soin.
5. Les nouveaux comptes personnels doivent en general passer par un test ferme
   avec un nombre minimal de testeurs avant la production : verifier les regles
   en vigueur dans la Play Console.
