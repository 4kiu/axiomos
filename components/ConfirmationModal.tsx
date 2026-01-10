import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const accentColor = variant === 'danger' ? 'rose' : 'amber';

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" 
        onClick={onCancel} 
      />
      <div className={`relative bg-[#1a1a1a] border border-neutral-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl bg-${accentColor}-500/10 border border-${accentColor}-500/20 text-${accentColor}-500`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
              <div className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest mt-0.5">System Protocol Active</div>
            </div>
          </div>
          
          <p className="text-sm text-neutral-400 leading-relaxed font-sans">
            {message}
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onConfirm}
              className={`w-full py-3 bg-${accentColor}-600 hover:bg-${accentColor}-500 text-white font-bold rounded-xl transition-all active:scale-95 uppercase text-xs tracking-widest`}
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 font-bold rounded-xl transition-all uppercase text-xs tracking-widest"
            >
              Cancel
            </button>
          </div>
        </div>
        
        <div className="absolute top-2 right-2">
          <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={16} className="text-neutral-600" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationModal;