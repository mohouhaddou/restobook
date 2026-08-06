const brandPath = (file) => `${import.meta.env.BASE_URL}brand/${file}`;

export const BRAND_ASSETS = {
  logoLight:   brandPath('ifilino_light.png'),
  logoDark:    brandPath('ifilino_dark.png'),
  footerLight: brandPath('ifilino__footer_light.png'),
  footerDark:  brandPath('ifilino_footer_dark.png'),
  icon:        brandPath('ifilino_favicon.png'),
};
