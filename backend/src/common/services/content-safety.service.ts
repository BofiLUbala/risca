import { Injectable } from '@nestjs/common';

export interface SafetyViolation {
  rule: string;
  message: string;
  match?: string;
}

export interface SafetyResult {
  safe: boolean;
  violations: SafetyViolation[];
}

const REGEX_SPECIALS = '.*+?^${}()|[]\\';

function escapeWord(value: string): string {
  const escaped = value
    .split('')
    .map((ch) => (REGEX_SPECIALS.includes(ch) ? '\\' + ch : ch))
    .join('');
  return '\\b' + escaped + '\\b';
}

/**
 * Verification automatique des publications (section 8.2 du plan fonctionnel).
 * Bloque le nom de famille, l'adresse exacte et les donnees medicales
 * ou psychotrauma avant toute publication publique.
 */
@Injectable()
export class ContentSafetyService {
  private readonly medicalTerms = [
    'vih',
    'sida',
    'seropositif',
    'seropositive',
    'tuberculose',
    'hepatite',
    'diagnostic',
    'antiretroviral',
    'ordonnance',
    'psychotrauma',
    'viol',
    'depression severe',
    'schizophrenie',
    'handicap mental',
    'groupe sanguin',
    'dossier medical',
    'maladie chronique',
    'therapie',
    'antidepresseur',
  ];

  private readonly patterns: Array<{ rule: string; re: RegExp; message: string }> = [
    {
      rule: 'EXACT_ADDRESS',
      re: /\b(avenue|av\.|rue|boulevard|bld|quartier|parcelle|n[°o]\s?\d+)\s+[\w'-]+/i,
      message: 'Adresse exacte interdite dans une publication publique',
    },
    {
      rule: 'GPS_COORDINATES',
      re: /-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/,
      message: 'Coordonnees GPS interdites dans une publication publique',
    },
    {
      rule: 'PHONE_NUMBER',
      re: /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}\b/,
      message: 'Numéro de telephone interdit dans une publication publique',
    },
    {
      rule: 'EMAIL',
      re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/,
      message: 'Adresse e-mail interdite dans une publication publique',
    },
  ];

  /** Minuscules sans accents, pour comparer de facon robuste. */
  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  /**
   * @param content  texte de la publication
   * @param lastName nom de famille de l'enfant concerne (jamais publiable)
   */
  check(content: string, lastName?: string | null): SafetyResult {
    const violations: SafetyViolation[] = [];
    const normalized = this.normalize(content);

    if (lastName && lastName.trim().length >= 3) {
      const target = this.normalize(lastName.trim());
      const re = new RegExp(escapeWord(target), 'i');
      if (re.test(normalized)) {
        violations.push({
          rule: 'LAST_NAME',
          message:
            "Le nom de famille de l'enfant ne peut pas apparaitre dans une publication publique",
          match: lastName,
        });
      }
    }

    for (const term of this.medicalTerms) {
      if (new RegExp(escapeWord(term), 'i').test(normalized)) {
        violations.push({
          rule: 'MEDICAL_DATA',
          message: 'Donnees medicales ou psychotrauma interdites dans une publication publique',
          match: term,
        });
        break;
      }
    }

    for (const pattern of this.patterns) {
      const m = content.match(pattern.re);
      if (m) {
        violations.push({ rule: pattern.rule, message: pattern.message, match: m[0] });
      }
    }

    return { safe: violations.length === 0, violations };
  }
}
