import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, HelpCircle, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModernConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSecondary?: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  type?: 'danger' | 'info' | 'warning' | 'success';
  isLoading?: boolean;
  oneButton?: boolean;
  customOnClose?: () => void;
}

const ModernConfirmModal: React.FC<ModernConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onSecondary,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  secondaryLabel,
  type = 'info',
  isLoading = false,
  oneButton = false
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const overlayRoot = typeof document !== 'undefined'
    ? document.querySelector('[data-dashboard-section-overlay-root]') as HTMLElement | null
    : null;
  const useSectionOverlay = Boolean(overlayRoot);

  const icons = {
    danger: <Trash2 className="w-6 h-6" />,
    warning: <AlertCircle className="w-6 h-6" />,
    success: <CheckCircle2 className="w-6 h-6" />,
    info: <HelpCircle className="w-6 h-6" />,
  };

  const iconColors = {
    danger: 'text-destructive bg-destructive/10',
    warning: 'text-warning bg-warning-muted/70',
    success: 'text-success bg-success-muted/70',
    info: 'text-primary bg-primary/10',
  };

  const buttonColors = {
    danger: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
    warning: 'bg-warning hover:bg-warning/90 text-warning-foreground',
    success: 'bg-success hover:bg-success/90 text-success-foreground',
    info: 'bg-ig-gradient text-white shadow-ig-glow hover:shadow-instagram',
  };

  const modalContent = (
    <div className={cn(
      useSectionOverlay
        ? 'pointer-events-auto absolute inset-0 z-[220] flex items-center justify-center p-4'
        : 'pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center p-4'
    )}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm transition-opacity duration-200"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="ig-topline relative bg-card w-full max-w-md rounded-2xl shadow-lg border border-border overflow-hidden animate-fadeInScale">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-4 mb-6">
            {/* Icon */}
            <div className={cn(
              "p-3 rounded-xl transition-all duration-200",
              iconColors[type]
            )}>
              {icons[type]}
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground tracking-tight">
                {title}
              </h3>
              {typeof description === 'string' ? (
                <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px] mx-auto">
                  {description}
                </p>
              ) : (
                <div className="text-muted-foreground text-sm leading-relaxed max-w-[320px] mx-auto">
                  {description}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {/* Primary Action */}
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm disabled:opacity-50",
                buttonColors[type]
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                confirmLabel
              )}
            </button>

            {/* Secondary Action */}
            {onSecondary && secondaryLabel && (
              <button
                onClick={onSecondary}
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
              >
                {secondaryLabel}
              </button>
            )}

            {/* Cancel Action */}
            {!oneButton && (
              <button
                onClick={onClose}
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
              >
                {cancelLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, overlayRoot || document.body);
};

export default ModernConfirmModal;
