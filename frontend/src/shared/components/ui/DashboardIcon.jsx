import React from 'react';
import { PremiumIcon, PremiumIconBadge } from './PremiumIcon';

const EMOJI_TO_ICON = {
  '🏠': 'home', '🛒': 'cart', '🛍️': 'shopping', '💳': 'card', '📊': 'chart', '👤': 'user',
  '📝': 'note', '🪪': 'card', '🔔': 'bell', '🤖': 'sparkles', '👨‍👩‍👧': 'users', '🎁': 'gift',
  '🧭': 'directions', '🔁': 'refresh', '💊': 'medicine', '🎟️': 'ticket', '📦': 'package',
  '🗓️': 'calendar', '📅': 'calendar', '⭐': 'star', '💰': 'wallet', '💵': 'wallet', '🧾': 'receipt',
  '📜': 'history', '📋': 'clipboard', '🍽️': 'utensils', '🪑': 'table', '🚚': 'delivery',
  '🎯': 'target', '✅': 'check', '❌': 'close', '👥': 'users', '📭': 'inbox', '📷': 'camera',
  '🛵': 'delivery', '🏃': 'shopping', '💉': 'medicine', '📥': 'download', '📨': 'message',
  '📑': 'fileText', '⚙️': 'settings', '🎠': 'image', '🏆': 'award', '📈': 'trendingUp',
  '📉': 'trendingDown', '📄': 'fileText', '📚': 'book', '✏️': 'edit', '✏': 'edit', '🗑️': 'trash',
  '🗑': 'trash', '🔍': 'search', '🔒': 'lock', '💬': 'message', '📍': 'mapPin', '🕐': 'clock',
  '🕓': 'clock', '❤️': 'heart', '⏳': 'clock', '👻': 'user', '🌐': 'globe', '🏁': 'check',
  '👨‍🍳': 'chef', '🌙': 'moon', '☀️': 'sun', '⚠️': 'alert', '⚠': 'alert', '📒': 'book',
  '🔀': 'shuffle', '🏦': 'bank', '📱': 'phone', '💾': 'save', '👁': 'eye', '🖼️': 'image',
  '🖥️': 'monitor', '🧠': 'cpu', '🌡️': 'thermometer', '💽': 'database', '🗄️': 'database',
  '🚨': 'alert', '🧩': 'settings', '🔄': 'refresh', '🖨️': 'printer', '🚗': 'car', '🚶': 'user',
  '🚲': 'bike', '🛴': 'bike', '🏍️': 'bike', '🚐': 'truck', '🛡️': 'shield', 'ℹ️': 'info',
  '🎂': 'gift', '🏅': 'award', '💸': 'wallet', '➕': 'plus', '✨': 'sparkles', '✉️': 'message',
  '📡': 'radio',
  '📞': 'phone',
  '📤': 'share',
  '📁': 'folder',
  '⌨️': 'keyboard',
  '🔗': 'link',
  '📘': 'globe',
  '💎': 'gem',
  '🚫': 'ban',
  '🌍': 'globe',
  '🏷️': 'tags',
  '🔥': 'flame',
  '💡': 'lightbulb',
  '🔮': 'sparkles',
  '🏛️': 'building',
  '🔘': 'circle',
  '☑️': 'check',
  '🔢': 'plus',
  '⚖️': 'settings',
  '❓': 'info',
  '⏱': 'clock',
  '📧': 'mail',
  '🚀': 'rocket',
  '🛎️': 'bell',
  '🖱': 'target',
  '📆': 'calendar',
  '⏰': 'clock',
  '🔴': 'alert',
  '⚪': 'circle',
};

export function dashboardIconName(icon) {
  if (!icon) return 'store';
  return EMOJI_TO_ICON[icon] || icon;
}

export function DashboardIcon({ icon, name, size = 18, badge = false, className = '', style }) {
  const iconName = dashboardIconName(name || icon);
  if (badge) return <PremiumIconBadge name={iconName} size={size} className={className} style={style} />;
  return <PremiumIcon name={iconName} size={size} className={className} style={style} />;
}

export default DashboardIcon;
