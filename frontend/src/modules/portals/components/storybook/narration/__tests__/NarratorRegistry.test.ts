import { describe, it, expect, beforeEach } from 'vitest';
import { getRememberedVoice, rememberVoice, forgetVoice } from '../NarratorRegistry';

beforeEach(() => {
  localStorage.clear();
});

describe('NarratorRegistry', () => {
  it('aucune voix mémorisée par défaut', () => {
    expect(getRememberedVoice('fr')).toBeNull();
  });

  it('mémorise puis retrouve une voix pour une langue', () => {
    rememberVoice('fr', 'fr_FR-tom-medium');
    expect(getRememberedVoice('fr')).toBe('fr_FR-tom-medium');
  });

  it('mémorise indépendamment par langue', () => {
    rememberVoice('fr', 'fr_FR-tom-medium');
    rememberVoice('en', 'af_heart');
    expect(getRememberedVoice('fr')).toBe('fr_FR-tom-medium');
    expect(getRememberedVoice('en')).toBe('af_heart');
  });

  it('un nouveau choix pour la même langue remplace le précédent', () => {
    rememberVoice('en', 'af_heart');
    rememberVoice('en', 'am_fenrir');
    expect(getRememberedVoice('en')).toBe('am_fenrir');
  });

  it('forgetVoice efface uniquement la langue visée', () => {
    rememberVoice('fr', 'fr_FR-tom-medium');
    rememberVoice('en', 'af_heart');
    forgetVoice('fr');
    expect(getRememberedVoice('fr')).toBeNull();
    expect(getRememberedVoice('en')).toBe('af_heart');
  });

  it('survit à une nouvelle lecture (persistance réelle via localStorage, pas juste en mémoire)', () => {
    rememberVoice('ar', 'ar_JO-kareem-medium');
    // Relit directement depuis le stockage, sans passer par un état JS en mémoire.
    const raw = localStorage.getItem('ifilino:narrator-registry');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ ar: 'ar_JO-kareem-medium' });
  });

  it('ne casse jamais si le contenu stocké est corrompu — retombe sur "aucune voix mémorisée"', () => {
    localStorage.setItem('ifilino:narrator-registry', 'ceci n\'est pas du JSON valide');
    expect(getRememberedVoice('fr')).toBeNull();
    // Doit aussi rester utilisable en écriture après une lecture corrompue.
    rememberVoice('fr', 'fr_FR-siwis-medium');
    expect(getRememberedVoice('fr')).toBe('fr_FR-siwis-medium');
  });
});
