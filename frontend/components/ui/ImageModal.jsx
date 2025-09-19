import React from "react";

export default function ImageModal({ open, src, alt, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-4 max-w-lg w-full flex flex-col items-center">
        <img src={src} alt={alt} className="max-h-[70vh] w-auto rounded-lg object-contain" />
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
