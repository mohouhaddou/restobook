import { describe, it, expect } from 'vitest';
import {
  directionForLanguage, imageSideFor, navButtonsFor,
  keyToActionFor, swipeDeltaToAction, slideOffsetFor,
} from '../RTLLayoutManager';

describe('directionForLanguage', () => {
  it('arabe → rtl', () => expect(directionForLanguage('ar')).toBe('rtl'));
  it('français/anglais → ltr', () => {
    expect(directionForLanguage('fr')).toBe('ltr');
    expect(directionForLanguage('en')).toBe('ltr');
  });
});

describe('imageSideFor', () => {
  it('LTR : illustration à gauche, texte à droite', () => expect(imageSideFor('ltr')).toBe('left'));
  it('RTL : inversé — illustration à droite, texte à gauche', () => expect(imageSideFor('rtl')).toBe('right'));
});

describe('navButtonsFor', () => {
  it('LTR : bouton physique gauche = précédent, droit = suivant', () => {
    const b = navButtonsFor('ltr');
    expect(b.physicalLeft.action).toBe('prev');
    expect(b.physicalRight.action).toBe('next');
    expect(b.physicalLeft.icon).toBe('chevron-left');
    expect(b.physicalRight.icon).toBe('chevron-right');
  });
  it('RTL : bouton physique gauche = suivant, droit = précédent (logique de lecture inversée)', () => {
    const b = navButtonsFor('rtl');
    expect(b.physicalLeft.action).toBe('next');
    expect(b.physicalRight.action).toBe('prev');
  });
});

describe('keyToActionFor', () => {
  it('LTR : flèche droite = suivant, flèche gauche = précédent', () => {
    expect(keyToActionFor('ltr', 'ArrowRight')).toBe('next');
    expect(keyToActionFor('ltr', 'ArrowLeft')).toBe('prev');
  });
  it('RTL : flèches inversées', () => {
    expect(keyToActionFor('rtl', 'ArrowRight')).toBe('prev');
    expect(keyToActionFor('rtl', 'ArrowLeft')).toBe('next');
  });
  it('touche non pertinente → null', () => {
    expect(keyToActionFor('ltr', 'Enter')).toBeNull();
  });
});

describe('swipeDeltaToAction', () => {
  it('LTR : glisser vers la gauche (delta négatif) = suivant', () => {
    expect(swipeDeltaToAction('ltr', -80, 60)).toBe('next');
    expect(swipeDeltaToAction('ltr', 80, 60)).toBe('prev');
  });
  it('RTL : glissements inversés', () => {
    expect(swipeDeltaToAction('rtl', -80, 60)).toBe('prev');
    expect(swipeDeltaToAction('rtl', 80, 60)).toBe('next');
  });
  it('sous le seuil → aucune action', () => {
    expect(swipeDeltaToAction('ltr', 10, 60)).toBeNull();
  });
});

describe('slideOffsetFor', () => {
  it('LTR, navigation "next" : entrée depuis la droite, sortie vers la gauche', () => {
    expect(slideOffsetFor('ltr', 'enter', 'next')).toBeGreaterThan(0);
    expect(slideOffsetFor('ltr', 'exit', 'next')).toBeLessThan(0);
  });
  it('RTL, navigation "next" : sens visuel inversé par rapport au LTR', () => {
    expect(slideOffsetFor('rtl', 'enter', 'next')).toBeLessThan(0);
    expect(slideOffsetFor('rtl', 'exit', 'next')).toBeGreaterThan(0);
  });
  it('"prev" inverse le signe par rapport à "next", quel que soit le sens', () => {
    expect(Math.sign(slideOffsetFor('ltr', 'enter', 'prev'))).toBe(-Math.sign(slideOffsetFor('ltr', 'enter', 'next')));
    expect(Math.sign(slideOffsetFor('rtl', 'enter', 'prev'))).toBe(-Math.sign(slideOffsetFor('rtl', 'enter', 'next')));
  });
});
