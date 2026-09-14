import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  variant: 'success' | 'error';
  duration?: number;
}

interface NotificationContextType {
  showToast: (message: string, variant: 'success' | 'error', duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface ToastItemProps {
  toast: ToastMessage;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const { message, variant, duration = 4000 } = toast;
  const isSuccess = variant === 'success';

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="pointer-events-auto relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-neutral-200/90 dark:border-neutral-800/90 bg-white/95 dark:bg-neutral-900/95 text-neutral-900 dark:text-neutral-100 px-5 py-4 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12),0_4px_16px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_14px_45px_-8px_rgba(0,0,0,0.6),0_4px_16px_-4px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-200 animate-in fade-in-0 slide-in-from-top-2 sm:slide-in-from-right-4"
      role="alert"
    >
      {/* Inline styles for the progress bar animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .toast-progress-bar-${toast.id} {
          animation: toast-progress ${duration}ms linear forwards;
        }
      `}} />

      {/* Hairline Progress Indicator */}
      <div 
        className={`absolute bottom-0 left-0 h-[2.5px] ${
          isSuccess ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'
        } toast-progress-bar-${toast.id}`}
      />

      {/* Refined Icon Badge */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
        isSuccess
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400'
          : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400'
      }`}>
        {isSuccess ? <Check className="h-4 w-4 stroke-[2.5]" /> : <AlertCircle className="h-4 w-4 stroke-[2.5]" />}
      </div>

      {/* Message Text with Clean Technical Micro-Header */}
      <div className="min-w-0 flex-1 pr-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] font-mono font-semibold tracking-wider uppercase ${
            isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {isSuccess ? 'Success' : 'Error'}
          </span>
        </div>
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-snug break-words">
          {message}
        </p>
      </div>

      {/* Minimal Close Button */}
      <button
        onClick={onClose}
        className="shrink-0 p-1.5 -mr-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, variant: 'success' | 'error', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
  }, []);

  const showSuccess = useCallback((message: string, duration = 4000) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration = 4000) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div 
            className="fixed top-5 right-5 left-5 mx-auto sm:left-auto sm:right-6 z-[99999] flex flex-col gap-3 pointer-events-none w-auto max-w-[calc(100%-2.5rem)] sm:w-[390px]"
            data-testid="toast-container"
          >
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
          </div>,
          document.body
        )}
    </NotificationContext.Provider>
  );
};
export default NotificationProvider;
