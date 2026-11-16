import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — RISAC',
  description:
    "Comment la plateforme RISAC collecte, utilise, protège et partage les données personnelles de ses utilisateurs et des enfants suivis.",
};

import { PrivacyContent } from './PrivacyContent';

/** La page reste un composant serveur (métadonnées) ; le texte, traduisible, est dans PrivacyContent. */
export default function ConfidentialitePage() {
  return <PrivacyContent />;
}
