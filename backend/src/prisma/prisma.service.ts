import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.enforceSingleSuperAdmin();
  }

  /**
   * Règle métier : il n'existe qu'un seul Super Admin. Prisma ne sait pas déclarer un index
   * partiel : on le crée ici, de façon idempotente. La base refuse alors toute seconde ligne
   * SUPER_ADMIN, même si deux requêtes arrivent en même temps.
   */
  private async enforceSingleSuperAdmin() {
    try {
      await this.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "one_super_admin_only" ON "User" ("role") WHERE "role" = 'SUPER_ADMIN'`,
      );
    } catch (e: any) {
      // Une base qui contient déjà plusieurs Super Admin ne peut pas recevoir l'index : on le dit clairement.
      console.error(`[RISAC] Index « un seul Super Admin » impossible à créer : ${e?.message ?? e}`);
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
