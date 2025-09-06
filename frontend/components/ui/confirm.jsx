import React from 'react';
import { Button } from './button';

export function ConfirmDialog({ open, title = 'Are you sure?', description = '', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description ? <p className="text-sm text-gray-600 mb-4">{description}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>{cancelText}</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
}
