export type Lang = 'fr' | 'en';

/** Mots outils les plus fréquents : assez pour distinguer le français de l'anglais sur une phrase. */
const FR = new Set(
  'le la les un une des du de et est sont pour avec dans sur par pas que qui ce cette ces au aux nous vous il elle ils elles son sa ses leur leurs mais ou donc a été être avoir fait très plus aussi comme tout tous notre nos votre vos merci bonjour enfant enfants'.split(' '),
);
const EN = new Set(
  'the a an and is are was were for with in on by not that which this these those to of we you he she they his her their but or so be been have has had do does very more also like all our your thank thanks hello child children'.split(' '),
);

/**
 * Langue probable d'un texte (français ou anglais), ou null si on ne peut pas trancher
 * (nom propre, chiffres, mot isolé) : dans ce cas on n'envoie rien au traducteur.
 */
export function detectLang(text: string): Lang | null {
  const words = text.toLowerCase().normalize('NFC').replace(/’/g, "'").match(/[a-zà-ÿœ']+/g) ?? [];
  let fr = 0;
  let en = 0;
  for (const raw of words) {
    let w = raw;
    if (/^[ldjmnstc]'/.test(w)) {
      fr++;
      w = w.slice(2);
    } else if (/'s$/.test(w)) {
      en++;
      w = w.slice(0, -2);
    }
    if (FR.has(w)) fr++;
    if (EN.has(w)) en++;
  }
  fr += (text.match(/[éèêàçùâîôûëïœ]/gi) ?? []).length * 0.5;
  if (fr === 0 && en === 0) return null;
  if (fr > en * 1.2) return 'fr';
  if (en > fr * 1.2) return 'en';
  return null;
}
