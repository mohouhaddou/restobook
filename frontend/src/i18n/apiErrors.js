const API_ERROR_KEYS = {
  CART_EMPTY: 'errors.api.cartEmpty',
  PRODUCT_UNAVAILABLE: 'errors.api.productUnavailable',
  STORE_CLOSED: 'errors.api.storeClosed',
  MINIMUM_ORDER_NOT_REACHED: 'errors.api.minimumOrderNotReached',
  DELIVERY_NOT_AVAILABLE: 'errors.api.deliveryNotAvailable',
  INVALID_ADDRESS: 'errors.api.invalidAddress',
  INVALID_TIME_SLOT: 'errors.api.invalidTimeSlot',
  PAYMENT_FAILED: 'errors.api.paymentFailed',
  ORDER_NOT_FOUND: 'errors.api.orderNotFound',
  ORDER_ALREADY_CANCELLED: 'errors.api.orderAlreadyCancelled',
  ORDER_STATUS_CONFLICT: 'errors.api.orderStatusConflict',
  UNAUTHORIZED_ORDER_ACCESS: 'errors.api.unauthorizedOrderAccess',
};

export function translateApiError(t, error, fallbackKey = 'errors.api.generic') {
  const code = error?.code || error?.error_code || error?.response?.data?.code || error?.response?.data?.error_code;
  if (code && API_ERROR_KEYS[code]) return t(API_ERROR_KEYS[code]);
  return t(fallbackKey);
}
