/**
 * Contrat de données pour la page de présentation d'un livre Kids (BookLandingPage) — reflète
 * exactement le JSON documenté dans backend/src/modules/portals/serializer.js. Tous les champs
 * sont optionnels : un livre qui n'a pas encore de PDF/audio/coloriages/etc. ne doit jamais planter
 * un composant, seulement lui faire afficher un état "à venir" ou se masquer proprement — jamais
 * de valeur codée en dur pour compenser une absence de donnée.
 */

export interface BookCharacter {
  readonly name: string;
  readonly image?: string;
  readonly description?: string;
  readonly traits?: readonly string[];
  readonly colors?: readonly string[];
  readonly accessories?: readonly string[];
}

export interface BookLearningGoal {
  readonly icon?: string;
  readonly label: string;
}

export interface BookValue {
  readonly icon?: string;
  readonly label: string;
}

export interface BookPreviewPage {
  readonly page: number;
  readonly image: string;
}

export interface BookPdfInfo {
  readonly url?: string;
  readonly free?: boolean;
  readonly price?: number;
  readonly currency?: string;
}

export interface BookAudioInfo {
  readonly url?: string;
  readonly durationSeconds?: number;
  readonly free?: boolean;
  readonly price?: number;
  readonly currency?: string;
  readonly narrator?: string;
  readonly languages?: readonly string[];
}

export interface BookColoringPack {
  readonly url?: string;
  readonly previewImages?: readonly string[];
}

export interface BookActivity {
  readonly type: string;
  readonly label: string;
  readonly free?: boolean;
}

export interface BookActivitiesPack {
  readonly free?: boolean;
  readonly price?: number;
  readonly currency?: string;
  readonly activities?: readonly BookActivity[];
}

export interface BookRelatedProduct {
  readonly type: string;
  readonly label: string;
  readonly price?: number;
  readonly currency?: string;
  readonly url?: string;
}

export interface BookReview {
  readonly author: string;
  readonly rating: number;
  readonly comment?: string;
  readonly date?: string;
}

export interface BookRating {
  readonly average?: number;
  readonly count?: number;
}

export interface BookMetadata {
  readonly subtitle?: string;
  readonly author?: string;
  readonly illustrator?: string;
  readonly narrator?: string;
  readonly translator?: string;
  readonly languages?: readonly string[];
  readonly ageRange?: string;
  readonly isbn?: string;
  readonly version?: string;
  readonly licence?: string;
  readonly wordCount?: number;
  readonly pageCount?: number;
  readonly illustrationCount?: number;
  readonly readingMinutes?: number;
  readonly pdf?: BookPdfInfo;
  readonly audio?: BookAudioInfo;
  readonly previewPages?: readonly BookPreviewPage[];
  readonly characters?: readonly BookCharacter[];
  readonly learningGoals?: readonly BookLearningGoal[];
  readonly values?: readonly BookValue[];
  readonly coloringPack?: BookColoringPack;
  readonly activitiesPack?: BookActivitiesPack;
  readonly relatedProducts?: readonly BookRelatedProduct[];
  readonly recommendedBooks?: readonly string[];
  readonly rating?: BookRating;
  readonly reviews?: readonly BookReview[];
}

export interface BookItem {
  readonly id: number;
  readonly portal: string;
  readonly type: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt?: string;
  readonly body?: string;
  readonly image_url?: string;
  readonly category?: string;
  readonly metadata: BookMetadata;
  readonly featured: boolean;
  readonly isPremium: boolean;
  readonly previewLength: number;
  readonly premiumBadge: string;
  readonly access: { readonly hasFullAccess: boolean; readonly isPreview: boolean };
  readonly published_at?: string;
  readonly view_count: number;
  readonly seo: { readonly title: string; readonly description?: string };
  readonly available_languages?: readonly string[];
  readonly language_urls?: Readonly<Record<string, string>>;
}
