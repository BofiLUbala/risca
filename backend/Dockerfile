# syntax=docker/dockerfile:1
# Image de production de l'API RISAC. Compatible Northflank, Render et tout
# hebergeur qui construit un Dockerfile et injecte le port via PORT.

# ─── Etape 1 : build ───
FROM node:22-bookworm-slim AS build
WORKDIR /app

# argon2 compile un binaire natif ; openssl est requis par Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

# Retire les dependances de developpement (nest-cli, typescript, jest...) puis
# regenere le client Prisma, que l'elagage peut emporter. La CLI prisma est
# une dependance de production : le `db push` du demarrage en a besoin.
RUN npm prune --omit=dev && npx prisma generate

# ─── Etape 2 : image d'execution ───
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Valeur de repli : Northflank et Render imposent leur propre PORT.
ENV PORT=4000

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json

# Repertoire d'uploads : ephemere sans volume monte (voir docs/DEPLOIEMENT.md).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 4000

# Le schema est pousse au demarrage. Le projet n'a pas encore de dossier
# prisma/migrations : `db push` est donc l'equivalent utilisable ici. Des qu'un
# historique de migrations existera, remplacer par `prisma migrate deploy`.
# `exec` remet node en PID 1 pour qu'il recoive SIGTERM a l'arret du conteneur.
CMD ["sh", "-c", "npx prisma db push --skip-generate && exec node dist/src/main"]
