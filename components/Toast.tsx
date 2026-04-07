
import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-600 border-emerald-400',
    error: 'bg-rose-600 border-rose-400',
    info: 'bg-indigo-600 border-indigo-400',
  };

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;

  return (
    <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] flex items-start gap-3 px-5 py-3 rounded-2xl border-2 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 w-[90vw] max-w-md ${styles[type]}`}>
      <div className="shrink-0 mt-0.5">
        <Icon size={18} className="text-white" />
      </div>
      <span className="text-sm font-black text-white flex-1 break-words leading-tight">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0 -mt-1 -mr-2">
        <X size={16} className="text-white/80" />
      </button>
    </div>
  );
};
