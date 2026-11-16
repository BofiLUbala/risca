import { detectLang } from './detect';
import { guessSource } from './translate.service';
import { chunk } from './providers';
import { TranslateService } from './translate.service';

describe('detectLang', () => {
  it('reconnaît le français', () => {
    expect(detectLang('Intervention nécessaire pour un enfant de la structure.')).toBe('fr');
    expect(detectLang("L'enfant a repris l'école cette semaine")).toBe('fr');
  });
  it('reconnaît l’anglais', () => {
    expect(detectLang('The child went back to school this week and is doing well.')).toBe('en');
  });
  it('ne tranche pas sur un nom propre ou des chiffres', () => {
    expect(detectLang('Orphelinat Espoir')).toBeNull();
    expect(detectLang('12345')).toBeNull();
  });
});

describe('chunk', () => {
  it('garde le texte entier quand il est court', () => {
    expect(chunk('Bonjour.', 450)).toEqual(['Bonjour.']);
  });
  it('coupe un texte long sans rien perdre', () => {
    const text = 'Une phrase assez longue pour le test. '.repeat(40);
    const parts = chunk(text, 450);
    expect(parts.every((p) => p.length <= 450)).toBe(true);
    expect(parts.join('')).toBe(text);
  });
});

describe('TranslateService', () => {
  const prisma = {
    translationCache: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  } as any;

  it('ne traduit pas un texte déjà dans la langue voulue et met en cache le reste', async () => {
    const svc = new TranslateService(prisma);
    const translate = jest.fn().mockResolvedValue('Urgent surgery for a child of the facility.');
    svc.useProvider({ name: 'fake', translate });

    const fr = 'Opération urgente pour un enfant de la structure.';
    const en = 'The child is doing well.';
    expect(await svc.translateMany([fr, en, ''], 'en')).toEqual(['Urgent surgery for a child of the facility.', en, '']);
    expect(await svc.translateMany([fr], 'en')).toEqual(['Urgent surgery for a child of the facility.']);
    expect(translate).toHaveBeenCalledTimes(1);
    expect(prisma.translationCache.createMany).toHaveBeenCalledTimes(1);
  });

  it('renvoie le texte d’origine si le fournisseur échoue', async () => {
    const svc = new TranslateService(prisma);
    svc.useProvider({ name: 'fake', translate: jest.fn().mockRejectedValue(new Error('down')) });
    const fr = 'Le projet est terminé pour les enfants.';
    expect(await svc.translateMany([fr], 'en')).toEqual([fr]);
  });
});

describe('guessSource', () => {
  it('suppose le français pour un titre sans indice quand on traduit vers l’anglais', () => {
    expect(guessSource('Operation chirurgicale urgente', 'en')).toBe('fr');
    expect(guessSource('Operation chirurgicale urgente', 'fr')).toBeNull();
    expect(guessSource('Espoir', 'en')).toBeNull();
  });
});
