import React from 'react';
import { useI18n } from '../../../i18n/config';

export function LanguageSelect({ compact = false, className = '' }) {
  const { language, options, setLanguage, t } = useI18n();

  return (
    <label className={`if-language-select ${compact ? 'if-language-select--compact' : ''} ${className}`.trim()}>
      {!compact && <span>{t('common.language')}</span>}
      <select
        value={language}
        onChange={event => setLanguage(event.target.value)}
        aria-label={t('common.language')}
      >
        {options.map(option => (
          <option key={option.code} value={option.code}>
            {compact ? option.code.toUpperCase() : option.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}

export default LanguageSelect;
