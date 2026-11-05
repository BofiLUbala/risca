import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Aucune page n'utilise l'ISR ni le cache incremental : la configuration par
// defaut suffit, sans KV ni R2.
export default defineCloudflareConfig();
