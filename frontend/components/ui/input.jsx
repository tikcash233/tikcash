import React from "react";

export const Input = React.forwardRef(function Input({ className = "", ...props }, ref) {
  const base = "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500";
  return <input ref={ref} className={[base, className].join(" ")} {...props} />;
});
