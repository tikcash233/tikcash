import React from "react";

export function Card({ className = "", children, ...props }) {
  return (
    <div className={["rounded-xl border border-gray-200 bg-white shadow-sm", className].join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={["px-6 pt-6", className].join(" ")} {...props}>{children}</div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
    <h3 className={["text-lg font-semibold leading-none tracking-tight", className].join(" ")} {...props}>{children}</h3>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={["p-6", className].join(" ")} {...props}>{children}</div>
  );
}
