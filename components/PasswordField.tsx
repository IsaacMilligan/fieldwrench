"use client";

import { useState } from "react";

type Props = {
  id?: string;
  name?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  value?: string;
  onChange?: (value: string) => void;
};

function EyeIcon({ slashed }: { slashed: boolean }) {
  return (
    <svg width="34" height="24" viewBox="0 0 48 32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M0 16C7.4 4.6 15.4 0 24 0s16.6 4.6 24 16C40.6 27.4 32.6 32 24 32S7.4 27.4 0 16z"
      />
      <circle cx="24" cy="16" r="9.4" fill="#0c0d0a" />
      <circle cx="22.4" cy="17.1" r="6.3" fill="currentColor" />
      {slashed ? (
        <rect
          x="21.15"
          y="-5"
          width="5.7"
          height="42"
          fill="currentColor"
          transform="rotate(-52 24 16)"
        />
      ) : null}
    </svg>
  );
}

export function PasswordField({
  id,
  name = "password",
  autoComplete,
  required,
  minLength,
  value,
  onChange,
}: Props) {
  const [show, setShow] = useState(false);
  const label = show ? "Hide password" : "Show password";
  return (
    <div className="relative">
      <input
        className="field"
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        spellCheck={false}
        style={{ paddingRight: 56 }}
      />
      <button
        type="button"
        className="absolute top-0 right-0 flex h-14 w-14 items-center justify-center text-[#c6ccb8]"
        aria-label={label}
        aria-pressed={show}
        tabIndex={0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShow((v) => !v)}
      >
        <EyeIcon slashed={show} />
      </button>
    </div>
  );
}
