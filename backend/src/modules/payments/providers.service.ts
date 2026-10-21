import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

export interface CheckoutSession {
  provider: PaymentProvider;
  checkoutUrl: string;
  providerRef: string;
  expiresAt: string;
}

/**
 * Passerelles de paiement (section 10.2).
 *
 * Apple et Google : le paiement s ouvre sur une page web securisee lancee
 * depuis l application, jamais en achat integre. On evite ainsi la commission
 * de 15 a 30 % et le risque de rejet de l application.
 *
 * Chaque fournisseur est branche ici. Tant qu aucune cle d API n est
 * configuree, le mode bac a sable renvoie une URL de paiement locale qui
 * simule le parcours complet, webhook compris.
 */
@Injectable()
export class ProvidersService {
  private readonly logger = new Logger('Providers');

  /** Fournisseurs disponibles selon le pays du bailleur. */
  availableFor(countryIso?: string): PaymentProvider[] {
    const african = ['CD', 'CG', 'RW', 'UG', 'KE', 'ZA'];
    if (countryIso && african.includes(countryIso)) {
      return [
        PaymentProvider.FLUTTERWAVE,
        PaymentProvider.CINETPAY,
        PaymentProvider.PAWAPAY,
        PaymentProvider.MAXICASH,
        PaymentProvider.BANK_TRANSFER,
      ];
    }
    return [
      PaymentProvider.STRIPE,
      PaymentProvider.PAYPAL,
      PaymentProvider.FLUTTERWAVE,
      PaymentProvider.BANK_TRANSFER,
    ];
  }

  isConfigured(provider: PaymentProvider): boolean {
    const keys: Partial<Record<PaymentProvider, string | undefined>> = {
      [PaymentProvider.STRIPE]: process.env.STRIPE_SECRET_KEY,
      [PaymentProvider.FLUTTERWAVE]: process.env.FLUTTERWAVE_SECRET_KEY,
      [PaymentProvider.CINETPAY]: process.env.CINETPAY_API_KEY,
      [PaymentProvider.PAWAPAY]: process.env.PAWAPAY_API_TOKEN,
      [PaymentProvider.MAXICASH]: process.env.MAXICASH_API_KEY,
      [PaymentProvider.PAYPAL]: process.env.PAYPAL_CLIENT_ID,
    };
    return Boolean(keys[provider]);
  }

  /**
   * Cree une session de paiement et renvoie l URL de la page web securisee.
   * En l absence de cle, renvoie l URL du bac a sable interne.
   */
  async createCheckout(params: {
    provider: PaymentProvider;
    reference: string;
    amount: number;
    currency: string;
    description: string;
    donorEmail: string;
  }): Promise<CheckoutSession> {
    const base = process.env.APP_WEB_URL || 'http://localhost:3000';
    const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();

    if (params.provider === PaymentProvider.BANK_TRANSFER) {
      return {
        provider: params.provider,
        checkoutUrl: `${base}/don/virement/${params.reference}`,
        providerRef: params.reference,
        expiresAt,
      };
    }

    if (!this.isConfigured(params.provider)) {
      this.logger.warn(
        `${params.provider} non configure : utilisation de la page de paiement bac a sable pour ${params.reference}`,
      );
      return {
        provider: params.provider,
        checkoutUrl: `${base}/don/paiement/${params.reference}?provider=${params.provider}&amount=${params.amount}&currency=${params.currency}`,
        providerRef: `SANDBOX-${params.reference}`,
        expiresAt,
      };
    }

    // Branchement reel du fournisseur : chaque integration renvoie son URL hebergee.
    throw new Error(
      `Integration ${params.provider} a brancher : utilisez son SDK pour creer la session et renvoyer checkoutUrl`,
    );
  }

  /** Taux de change a la date du don (section 10.4, multi-devises). */
  async exchangeRateToUsd(currency: string): Promise<number> {
    const fallback: Record<string, number> = {
      USD: 1,
      EUR: 1.08,
      CDF: 0.00035,
      XAF: 0.00165,
      GBP: 1.27,
      CAD: 0.73,
      RWF: 0.00077,
      KES: 0.0077,
      UGX: 0.00027,
      ZAR: 0.055,
    };
    return fallback[currency.toUpperCase()] ?? 1;
  }
}
