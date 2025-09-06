import React from "react";

export function Button({ as: Comp = "button", variant = "default", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    outline: "border-2 border-blue-300 text-blue-700 bg-white hover:bg-blue-50 focus:ring-blue-500",
  ghost: "text-blue-600 hover:bg-blue-50 focus:ring-blue-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-8 py-3 text-lg"
  };
  const classes = [base, variants[variant] || variants.default, sizes[size] || sizes.md, className].join(" ");
  return <Comp className={classes} {...props} />;
}
