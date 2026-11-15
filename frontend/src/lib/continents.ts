/**
 * Continents, par code ISO 3166-1 alpha-2. La base ne porte pas le continent des pays : on le déduit du code.
 * L'Amérique du Nord regroupe l'Amérique centrale et les Caraïbes ; la Turquie, le Caucase et le Kazakhstan sont en Asie.
 */
export type Continent = 'Afrique' | 'Amérique du Nord' | 'Amérique du Sud' | 'Asie' | 'Europe' | 'Océanie' | 'Antarctique' | 'Autres';

const LISTS: Record<Exclude<Continent, 'Autres'>, string> = {
  Afrique:
    'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH RE YT SH',
  Europe:
    'AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA AX FO GI GG IM JE SJ',
  Asie:
    'AF AM AZ BH BD BT BN KH CN GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE HK MO',
  'Amérique du Nord':
    'AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US AI AW BM BQ VG KY CW GL GP MQ MS PR BL MF PM SX TC VI UM',
  'Amérique du Sud': 'AR BO BR CL CO EC GY PY PE SR UY VE FK GF GS',
  Océanie: 'AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU AS CK GU NU NC NF MP PF PN TK WF CC CX HM',
  Antarctique: 'AQ BV TF',
};

const BY_ISO2 = new Map<string, Continent>();
for (const [continent, codes] of Object.entries(LISTS)) {
  for (const code of codes.split(' ')) BY_ISO2.set(code, continent as Continent);
}

export const continentOf = (iso2?: string | null): Continent => BY_ISO2.get((iso2 ?? '').toUpperCase()) ?? 'Autres';
