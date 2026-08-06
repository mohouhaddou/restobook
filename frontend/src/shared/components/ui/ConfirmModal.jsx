import React from 'react';
import { useI18n } from '../../../i18n/config';

export function ConfirmModal({
  show = true,
  title,
  message,
  confirmLabel,
  confirmClass = 'btn-danger',
  cancelLabel,
  onCancel,
  onConfirm,
}) {
  const { t } = useI18n();
  if (!show) return null;

  return (
    <>
      <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header border-0">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label={t('common.close')} onClick={onCancel} />
            </div>
            <div className="modal-body pt-0 text-secondary">{message}</div>
            <div className="modal-footer border-0 gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>{cancelLabel || t('common.cancel')}</button>
              <button type="button" className={`btn ${confirmClass}`} onClick={onConfirm}>
                {confirmLabel || t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
