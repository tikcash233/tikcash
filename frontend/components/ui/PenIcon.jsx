import React from "react";

const PenIcon = ({ size = 24, color = "#2563eb", className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M15.232 5.232a3 3 0 1 1 4.243 4.243l-9.193 9.193a2 2 0 0 1-.878.513l-3.06.817a.5.5 0 0 1-.606-.606l.817-3.06a2 2 0 0 1 .513-.878l9.193-9.193z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#fff"
    />
    <path
      d="M16 7l1 1"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default PenIcon;
