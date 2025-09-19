import React from "react";

const EditProfileIcon = ({ size = 32, color = "#2563eb", className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="24" cy="18" r="8" stroke={color} strokeWidth="2" fill="#fff" />
    <path
      d="M38 38v-2c0-4.418-7.163-8-14-8s-14 3.582-14 8v2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#fff"
    />
    <rect
      x="30"
      y="30"
      width="10"
      height="10"
      rx="2"
      fill="#fff"
      stroke={color}
      strokeWidth="2"
    />
    <path
      d="M32 36l4-4 2 2-4 4-2-2z"
      fill={color}
    />
    <path
      d="M36 32l2 2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default EditProfileIcon;
