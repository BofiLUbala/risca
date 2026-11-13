import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PASSWORD, ROLES, authFile, watch } from './support';

/**
 * Connexion réelle par le formulaire /connexion, rôle par rôle, comme un utilisateur.
 * La session (jetons en localStorage) est conservée pour parcourir ensuite les pages.
 */
for (const r of ROLES) {
  setup(`connexion ${r.role} (${r.email})`, async ({ page }, info) => {
    const f = watch(page);
    await page.goto('/connexion');
    await page.locator('#email').fill(r.email);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/tableau-de-bord', { timeout: 120_000 });
    await expect(page.locator('body')).not.toContainText(/Identifiants invalides/);

    const dir = path.join(__dirname, '..', 'screenshots', 'connexion');
    fs.mkdirSync(dir, { recursive: true });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    await page.screenshot({ path: path.join(dir, `${r.role}.png`) });

    for (const e of f.consoleErrors) info.annotations.push({ type: 'consoleErrors', description: e });
    fs.mkdirSync(path.dirname(authFile(r.role)), { recursive: true });
    await page.context().storageState({ path: authFile(r.role) });
  });
}
