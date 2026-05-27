import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

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
  const { message, variant, duration = 5000 } = toast;
  const isSuccess = variant === 'success';

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 px-5 py-4 shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 sm:slide-in-from-right-8 fade-in ${
        isSuccess
          ? 'bg-success text-success-foreground'
          : 'bg-destructive text-destructive-foreground'
      }`}
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

      {/* Progress Bar Timer */}
      <div 
        className={`absolute bottom-0 left-0 h-1 bg-white/30 toast-progress-bar-${toast.id}`}
      />

      {/* Icon Wrapper */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        {isSuccess ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      </div>

      {/* Text Info */}
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-90">
          {isSuccess ? 'Success' : 'Error'}
        </p>
        <p className="mt-0.5 text-sm font-bold leading-snug break-words">{message}</p>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/15 transition-all duration-200"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, variant: 'success' | 'error', duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
  }, []);

  const showSuccess = useCallback((message: string, duration = 5000) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration = 5000) => {
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
            className="fixed top-4 right-4 left-4 mx-auto sm:left-auto sm:right-6 z-[99999] flex flex-col gap-3 pointer-events-none w-auto max-w-[calc(100%-2rem)] sm:max-w-sm"
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
