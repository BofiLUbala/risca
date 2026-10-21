import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'dns';
import * as nodemailer from 'nodemailer';

export interface OtpMailInput {
  to: string;
  firstName: string;
  otp: string;
  ttlMinutes: number;
  /** Lien d'activation (invitation) : facultatif pour une simple vérification d'adresse. */
  activationUrl?: string;
  purpose: 'ACTIVATION' | 'VERIFY_EMAIL';
}

export interface MailResult {
  /** Le message a été remis au serveur SMTP. */
  sent: boolean;
  /** Mode de test : aucun message réel n'est envoyé, le code est renvoyé à l'appelant. */
  echoed: boolean;
  error?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Envoi d'e-mails par SMTP (variables SMTP_HOST, SMTP_PORT, SMTP_USER,
 * SMTP_PASSWORD, SMTP_FROM). Sert à remettre le code à usage unique (OTP)
 * qui conditionne l'activation d'un compte.
 */
@Injectable()
export class MailerService {
  private readonly log = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;

  /** Mode de test : jamais actif en production. */
  get echoMode(): boolean {
    return process.env.MAIL_ECHO_OTP === 'true' && process.env.NODE_ENV !== 'production';
  }

  isConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  }

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT ?? 587);
      const hostname = process.env.SMTP_HOST!;
      // Le résolveur DNS interne de Node (c-ares) échoue sur certains réseaux (VPN, antivirus, pare-feu)
      // alors que le système résout très bien : on résout via le système, puis on valide le certificat
      // TLS sur le vrai nom d'hôte.
      let host = hostname;
      try {
        host = (await dns.promises.lookup(hostname, { family: 4 })).address;
      } catch {
        /* à défaut, nodemailer tentera sa propre résolution */
      }
      this.transporter = nodemailer.createTransport({
        host,
        port,
        // 465 : TLS direct. 587 : STARTTLS, exigé pour ne jamais envoyer en clair.
        secure: port === 465,
        requireTLS: port !== 465,
        tls: { servername: hostname },
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
    }
    return this.transporter;
  }

  /** Vérifie la connexion et l'authentification SMTP, sans envoyer de message. */
  async verify(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) return { ok: false, error: 'SMTP non configuré' };
    try {
      await (await this.getTransporter()).verify();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Connexion SMTP impossible' };
    }
  }

  async sendOtp(input: OtpMailInput): Promise<MailResult> {
    if (this.echoMode) {
      this.log.warn(`MAIL_ECHO_OTP actif : aucun e-mail envoyé à ${input.to}`);
      return { sent: false, echoed: true };
    }
    if (!this.isConfigured()) {
      this.log.error('SMTP non configuré : impossible d’envoyer le code de vérification');
      return { sent: false, echoed: false, error: 'SMTP non configuré' };
    }

    const name = escapeHtml(input.firstName);
    const title = input.purpose === 'ACTIVATION' ? 'Activez votre compte RISAC' : 'Confirmez votre adresse e-mail';
    const intro =
      input.purpose === 'ACTIVATION'
        ? 'Vous avez été invité à rejoindre le Réseau International des Structures d’Accueil du Congo.'
        : 'Merci de vous être inscrit sur RISAC. Confirmez votre adresse pour activer votre compte.';
    const link = input.activationUrl
      ? `<p style="margin:24px 0"><a href="${escapeHtml(input.activationUrl)}" style="background:#1d6fd6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Ouvrir la page d’activation</a></p>`
      : '';

    const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1f2430">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e3e8ef">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:1px;color:#5e6573">RISAC · CONGO MEILLEUR</p>
    <h1 style="margin:0 0 16px;font-size:22px">${title}</h1>
    <p>Bonjour ${name},</p>
    <p>${intro}</p>
    <p style="margin:24px 0 8px">Votre code de vérification :</p>
    <p style="margin:0;font-size:34px;letter-spacing:10px;font-weight:700;color:#1d6fd6">${input.otp}</p>
    <p style="margin:8px 0 0;font-size:13px;color:#5e6573">Ce code expire dans ${input.ttlMinutes} minutes et ne peut être utilisé qu’une fois.</p>
    ${link}
    <p style="font-size:13px;color:#5e6573;margin-top:28px">Ne communiquez ce code à personne, pas même à un membre de RISAC. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>
  </div>
</div></body></html>`;

    const text = `${title}\n\nBonjour ${input.firstName},\n\n${intro}\n\nVotre code de vérification : ${input.otp}\nIl expire dans ${input.ttlMinutes} minutes.\n${input.activationUrl ? `\nPage d’activation : ${input.activationUrl}\n` : ''}\nNe communiquez ce code à personne. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.`;

    try {
      await (await this.getTransporter()).sendMail({
        from: `"RISAC" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: input.to,
        subject: `${input.otp} est votre code RISAC`,
        text,
        html,
      });
      return { sent: true, echoed: false };
    } catch (e: any) {
      // Le message d'erreur SMTP ne contient jamais le mot de passe ; on évite
      // néanmoins de journaliser le code.
      this.log.error(`Envoi du code à ${input.to} impossible : ${e?.message}`);
      return { sent: false, echoed: false, error: e?.message ?? 'Envoi impossible' };
    }
  }
}
