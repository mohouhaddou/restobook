// Table de correspondance unique état -> bouton (icône/libellé/action) pour tout produit
// numérique, quel que soit son type (`type` n'est jamais inspecté ici : voir PRODUCT_TYPE_ICONS
// dans DigitalProductCard.jsx pour le seul endroit où le type influence le rendu, un simple
// dictionnaire, jamais un if/else). `product` est la forme renvoyée par
// GET /digital-products/story/:id ou POST /digital-products/:id/purchase :
// { state, purchased, downloadReady }.
export function getProductButtonState(product) {
  const { state, purchased, downloadReady } = product;

  if (state === 'coming_soon' || state === 'disabled') {
    return { action: 'none', disabled: true, labelKey: 'kids.digitalProducts.actions.comingSoon', icon: 'Clock' };
  }
  if (state === 'generating') {
    return { action: 'wait', disabled: true, labelKey: 'kids.digitalProducts.actions.generating', icon: 'Loader' };
  }
  if (state === 'failed') {
    return { action: 'retry', disabled: false, labelKey: 'kids.digitalProducts.actions.retry', icon: 'RefreshCw' };
  }
  if (purchased && downloadReady) {
    return { action: 'download', disabled: false, labelKey: 'kids.digitalProducts.actions.download', icon: 'Download' };
  }
  // ready_to_generate ou available, jamais acheté.
  return { action: 'buy', disabled: false, labelKey: 'kids.digitalProducts.actions.buy', icon: 'ShoppingCart' };
}
