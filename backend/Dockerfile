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

# ─── Etape 2 : image d'execution ───
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# Repertoire d'uploads : ephemere sans volume monte (voir docs/DEPLOIEMENT.md).
RUN mkdir -p /app/uploads

EXPOSE 4000
# Le schema est pousse au demarrage. Le projet n'a pas encore de dossier
# prisma/migrations : `db push` est donc l'equivalent utilisable ici. Des qu'un
# historique de migrations existera, remplacer par `prisma migrate deploy`.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/src/main"]
