'use strict';

// Une pharmacie est "de garde" maintenant si elle est programmée (is_pharmacy_guard)
// ET que l'instant présent tombe dans la plage [guard_start_at, guard_end_at].
function isGuardActiveNow(biz) {
  if (!biz || !biz.is_pharmacy_guard || !biz.guard_start_at || !biz.guard_end_at) return false;
  const now = Date.now();
  return now >= new Date(biz.guard_start_at).getTime() && now <= new Date(biz.guard_end_at).getTime();
}

module.exports = { isGuardActiveNow };
