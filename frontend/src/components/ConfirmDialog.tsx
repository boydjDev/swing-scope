import type { ReactNode } from 'react'
import '../styles/ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel?: () => void
  input?: {
    value: string
    placeholder?: string
    onChange: (value: string) => void
    onEnter?: () => void
  }
}

export default function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDisabled,
  onConfirm,
  onCancel,
  input,
}: ConfirmDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <p className="dialog-title">{title}</p>
        {children && <div className="dialog-body">{children}</div>}
        {input && (
          <input
            className="dialog-input"
            type="text"
            placeholder={input.placeholder}
            value={input.value}
            onChange={e => input.onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && input.onEnter?.()}
            autoFocus
          />
        )}
        <div className="dialog-actions">
          {onCancel && (
            <button className="dialog-cancel" onClick={onCancel}>{cancelLabel}</button>
          )}
          <button className="dialog-confirm" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
