import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ isOpen, onClose, title, children, className }: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6 bg-[var(--overlay-bg)] backdrop-blur-sm transition-opacity">
      <div className={cn(
        "relative w-full max-w-md bg-white flex flex-col shadow-[var(--shadow-dialog)]",
        "h-full sm:h-auto sm:max-h-full sm:rounded-[var(--radius-dialog)] overflow-hidden",
        className
      )} data-ui-dialog>
        <div data-dialog-header className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0 bg-white z-10 shadow-sm">
          <h3 className="min-w-0 truncate pr-3 text-lg font-bold tracking-tight text-zinc-900">{title}</h3>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-[var(--radius-control)] p-2 transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div data-dialog-body className="p-4 sm:p-6 overflow-y-auto min-h-0 flex-1 custom-scrollbar bg-zinc-50/50">
          {children}
        </div>
      </div>
    </div>
  );
}
