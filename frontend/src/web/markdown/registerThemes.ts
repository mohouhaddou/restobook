import { ThemeRegistry } from './ThemeRegistry';
import { DiscoverTheme } from './themes/DiscoverTheme';
import { SportsTheme } from './themes/SportsTheme';
import { KidsTheme } from './themes/KidsTheme';

/**
 * Enregistrement central des thèmes — importé une fois (frontend/src/main.jsx)
 * pour que ThemeResolver puisse résoudre n'importe quel module dès le premier
 * rendu, quel que soit l'ordre de chargement des routes/chunks.
 *
 * Ajouter un futur module (Education, Santé, Voyage...) = un import + un
 * `register(...)` ici. Aucune autre modification requise.
 */
ThemeRegistry.register('discover', DiscoverTheme);
ThemeRegistry.register('sports', SportsTheme);
ThemeRegistry.register('kids', KidsTheme);
