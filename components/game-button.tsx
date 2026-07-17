"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  tone?: "orange" | "green" | "blue" | "red" | "white";
};

export function GameButton({ icon, tone = "orange", className = "", children, ...props }: Props) {
  return (
    <button className={`game-button game-button-${tone} ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
