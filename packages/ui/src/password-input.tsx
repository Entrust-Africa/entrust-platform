"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "./cn";

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** A password input with an eye button that shows or hides what was typed. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={cn(className, "w-full pr-11")} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25 disabled:cursor-not-allowed"
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
