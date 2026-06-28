const brandPath = (file) => `${import.meta.env.BASE_URL}brand/${file}`;

export const BRAND_ASSETS = {
  logoLight: brandPath('restobook_light.png'),
  logoDark: brandPath('restobook_dark.png'),
  icon: brandPath('restobook_icon_512.png'),
};

