import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.enforceSuperAdminLimit();
  }

  /**
   * Règle métier : trois Super Admin au plus, numérotés 1 (principal), 2 et 3. Prisma ne sait pas
   * déclarer un index partiel : on les crée ici, de façon idempotente. La base refuse alors un
   * quatrième Super Admin ou deux comptes du même rang, même si deux requêtes arrivent en même temps.
   */
  private async enforceSuperAdminLimit() {
    try {
      // Ancienne règle « un seul Super Admin » : remplacée par les rangs.
      await this.$executeRawUnsafe(`DROP INDEX IF EXISTS "one_super_admin_only"`);
      // Le Super Admin existant (créé avant les rangs) devient le principal.
      await this.$executeRawUnsafe(
        `UPDATE "User" SET "adminRank" = 1
           WHERE "role" = 'SUPER_ADMIN' AND "adminRank" IS NULL
             AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."role" = 'SUPER_ADMIN' AND u."adminRank" = 1)`,
      );
      await this.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "super_admin_rank_unique" ON "User" ("adminRank") WHERE "role" = 'SUPER_ADMIN'`,
      );
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE "User" ADD CONSTRAINT "super_admin_rank_range"
            CHECK ("role" <> 'SUPER_ADMIN' OR "adminRank" BETWEEN 1 AND 3);
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    } catch (e: any) {
      // Une base qui contient déjà un état incompatible ne peut pas recevoir les règles : on le dit clairement.
      console.error(`[RISAC] Règles « trois Super Admin au plus » impossibles à créer : ${e?.message ?? e}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Truncate every table - used only by the e2e test harness. */
  async resetDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('resetDatabase is forbidden in production');
    }
    const tables = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const names = tables
      .map((t) => `"public"."${t.tablename}"`)
      .filter((n) => !n.includes('_prisma_migrations'))
      .join(', ');
    if (names.length) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE ${names} CASCADE;`);
    }
  }
}
