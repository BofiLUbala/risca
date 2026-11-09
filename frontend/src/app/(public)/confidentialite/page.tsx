import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — RISAC',
  description:
    "Comment la plateforme RISAC collecte, utilise, protège et partage les données personnelles de ses utilisateurs et des enfants suivis.",
};

/*
 * BROUILLON A FAIRE RELIRE AVANT PUBLICATION. Les valeurs ORGANISATION,
 * EMAIL_CONTACT et DUREE_CONSERVATION sont renseignees.
 *
 * Le contenu decrit les categories de donnees presentes dans le schema Prisma
 * (backend/prisma/schema.prisma). Chaque affirmation doit etre confrontee a la
 * realite avant publication, en particulier : la duree de conservation, la
 * liste des prestataires, le fait qu'aucune donnee ne soit vendue, et la facon
 * dont le paiement est traite.
 */
const ORGANISATION = 'Albert Ndondo, porteur du projet RISAC';
const EMAIL_CONTACT = 'skyndo@gmail.com';
const DUREE_CONSERVATION =
  'Vos données sont conservées tant que votre compte est actif. Vous pouvez demander leur suppression à tout moment ; nous les supprimons dans un délai de 30 jours, sauf obligation légale de les garder.';
const MISE_A_JOUR = '9 novembre 2026';

const DONNEES = [
  {
    titre: 'Votre compte',
    texte:
      "Nom, prénom, adresse e-mail, numéro de téléphone (facultatif), pays et province, rôle sur la plateforme, structure de rattachement, langue, mot de passe (conservé sous une forme chiffrée, jamais en clair) et, si vous l’activez, les données de la double authentification.",
  },
  {
    titre: 'Les enfants suivis',
    texte:
      "Les structures d’accueil et les ambassadeurs saisissent des dossiers d’enfants : identité, situation familiale, suivi de santé, suivi psychosocial, scolarité, placements et transferts, documents et historique. Ces informations sont réservées aux personnes habilitées selon leur rôle. Le nom de famille d’un enfant n’est jamais public.",
  },
  {
    titre: 'Photos et vidéos',
    texte:
      "Les photos et vidéos d’un enfant ne sont publiées qu’avec un consentement enregistré (tuteur et, le cas échéant, enfant). Vous pouvez aussi ajouter des photos à vos publications et à vos justificatifs depuis l’application.",
  },
  {
    titre: 'Localisation',
    texte:
      "Lorsqu’un ambassadeur enregistre un rapport de visite, l’application peut y associer le lieu de la visite (latitude et longitude). Elle ne suit pas votre position en continu. La localisation précise est masquée dans les zones à risque.",
  },
  {
    titre: 'Dons et paiements',
    texte:
      "Montant, devise, moyen de paiement, référence de la transaction, message éventuel et statut du paiement. Le paiement se fait sur la page sécurisée du prestataire choisi (mobile money, carte, PayPal ou virement). Un don peut rester anonyme pour le public.",
  },
  {
    titre: 'Messages et publications',
    texte:
      "Publications, commentaires, réactions et messages échangés dans les espaces de discussion de la plateforme.",
  },
  {
    titre: 'Appareil et notifications',
    texte:
      "Si vous acceptez les notifications, nous enregistrons l’identifiant technique de votre appareil, sa plateforme et la date de dernière utilisation, pour vous envoyer des alertes.",
  },
  {
    titre: 'Journal de sécurité',
    texte:
      "Les actions importantes (connexions, validations, décaissements) sont enregistrées dans un journal d’audit afin de protéger les fonds et les enfants.",
  },
];

const FINALITES = [
  "Gérer votre compte et vous donner accès aux fonctions correspondant à votre rôle.",
  "Suivre et protéger les enfants accueillis par les structures partenaires.",
  "Tracer les dons depuis leur versement jusqu’à la preuve de dépense.",
  "Vous envoyer des notifications et des messages liés à votre activité.",
  "Assurer la sécurité de la plateforme, prévenir la fraude et les abus.",
  "Respecter nos obligations légales.",
];

const PARTENAIRES = [
  "Google Firebase, pour l’envoi des notifications sur téléphone.",
  "Les prestataires de paiement, pour traiter les dons.",
  "Nos hébergeurs : Cloudflare pour le site web et Amazon Web Services pour le serveur et la base de données.",
  "Un service d’envoi d’e-mails, pour les codes de vérification et les messages du système.",
];

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
        Politique de confidentialité
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-ink-600">
        Cette page explique quelles données la plateforme RISAC (site web et application mobile)
        collecte, pourquoi, comment elles sont protégées et avec qui elles sont partagées.
        Dernière mise à jour : {MISE_A_JOUR}.
      </p>

      <section className="mt-10 card card-pad">
        <h2 className="section-title">Qui est responsable de vos données</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Le responsable du traitement est {ORGANISATION}. Pour toute question ou demande, écrivez à{' '}
          {EMAIL_CONTACT}.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-ink-950">
          Les données que nous collectons
        </h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {DONNEES.map((d) => (
            <div key={d.titre} className="card card-pad">
              <h3 className="text-base font-semibold text-ink-900">{d.titre}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{d.texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-ink-950">Pourquoi nous les utilisons</h2>
        <ul className="mt-4 space-y-2">
          {FINALITES.map((f) => (
            <li key={f} className="rounded-xl bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-700">
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-ink-600">
          Nous ne vendons pas vos données et nous ne les utilisons pas pour de la publicité.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-ink-950">Avec qui nous les partageons</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Nous partageons des données uniquement lorsque c’est nécessaire au fonctionnement du service :
        </p>
        <ul className="mt-3 space-y-2">
          {PARTENAIRES.map((p) => (
            <li key={p} className="rounded-xl bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-700">
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-ink-600">
          Un bailleur n’a aucun contact direct avec un enfant, et il ne voit que les informations
          prévues pour son rôle. Nous pouvons aussi communiquer des données si la loi l’exige.
        </p>
      </section>

      <section className="mt-12 card card-pad">
        <h2 className="section-title">Combien de temps nous les gardons</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{DUREE_CONSERVATION}</p>
      </section>

      <section className="mt-12 card card-pad">
        <h2 className="section-title">Comment nous les protégeons</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Les échanges avec la plateforme sont chiffrés (HTTPS). Les mots de passe sont stockés sous
          forme chiffrée. L’accès aux données dépend du rôle de chaque personne, et les actions
          sensibles sont enregistrées dans un journal. Aucun système n’est infaillible : en cas
          d’incident touchant vos données, nous vous informerons dans les conditions prévues par la loi.
        </p>
      </section>

      <section className="mt-12 card card-pad">
        <h2 className="section-title">Vos droits</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Vous pouvez demander l’accès à vos données, leur correction, leur suppression ou la
          limitation de leur usage, et retirer un consentement donné, y compris la permission
          d’utiliser la localisation, la caméra ou les notifications, depuis les réglages de votre
          téléphone. Écrivez-nous à {EMAIL_CONTACT}. Nous répondons dans un délai raisonnable.
        </p>
      </section>

      <section className="mt-12 card card-pad">
        <h2 className="section-title">Modifications de cette page</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Nous pouvons modifier cette politique. La date de mise à jour figure en haut de la page. En cas
          de changement important, nous vous informerons dans l’application.
        </p>
      </section>
    </div>
  );
}
