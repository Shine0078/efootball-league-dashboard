
'use client';
import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [open, onCancel]);

  if (!open) return null;

  const label = confirmLabel ?? 'Confirm';
  const cancel = cancelLabel ?? 'Cancel';

  return (
    <div className='fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm' onClick={onCancel}>
      <div ref={ref} className='card w-full max-w-md p-6 shadow-2xl' onClick={(e) => e.stopPropagation()}>
        <h3 className='text-lg font-extrabold'>{title}</h3>
        <p className='mt-2 text-sm text-slate-400'>{message}</p>
        <div className='mt-5 flex justify-end gap-2'>
          <button className='btn-ghost !px-4 !py-2 text-sm' onClick={onCancel}>{cancel}</button>
          <button className={destructive ? 'btn-primary !px-4 !py-2 text-sm !bg-red-600 !border-red-600 hover:!bg-red-500' : 'btn-primary !px-4 !py-2 text-sm'} onClick={onConfirm}>{label}</button>
        </div>
      </div>
    </div>
  );
}
