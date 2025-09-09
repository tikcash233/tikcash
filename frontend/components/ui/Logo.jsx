import React from "react";
import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";

/**
 * Reusable brand logo.
 * Props:
 *  - to: router path to navigate (default '/')
 *  - size: base square size in px (default 40)
 *  - showText: show the TikCash text (default true)
 *  - tagline: optional small tagline under the name (default 'Creator Platform')
 *  - variant: 'light' | 'dark' (affects text color when placed on dark backgrounds)
 *  - withBurst: show the little white accent circle (default true)
 */
export default function Logo({
  to = "/",
  size = 40,
  showText = true,
  tagline = "Creator Platform",
  variant = "light",
  withBurst = true,
  className = "",
}) {
  const boxClasses = "bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg";
  const textColor = variant === "dark" ? "text-white" : "bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent";
  const nameClass = `text-lg font-bold tracking-tight ${textColor}`;
  const taglineClass = variant === "dark" ? "text-gray-400" : "text-gray-500";

  return (
    <Link to={to} className={`relative flex items-center gap-3 group select-none ${className}`} aria-label="TikCash home">
      <div className="relative" style={{ width: size, height: size }}>
        <div className={`${boxClasses}`} style={{ width: size, height: size }}>
          <TrendingUp className="h-[60%] w-[60%] text-white transition-transform duration-300 group-hover:scale-110" />
        </div>
        {withBurst && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-blue-600" />
        )}
      </div>
      {showText && (
        <div className="leading-tight">
          <div className={nameClass}>TikCash</div>
          {tagline && (
            <div className={`text-[10px] uppercase tracking-wider ${taglineClass}`}>{tagline}</div>
          )}
        </div>
      )}
    </Link>
  );
}
