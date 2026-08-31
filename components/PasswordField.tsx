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
    <div>
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
      />
      <button
        className="tap tap-ghost mt-2"
        type="button"
        aria-label={label}
        aria-pressed={show}
        onClick={() => setShow((v) => !v)}
      >
        {label}
      </button>
    </div>
  );
}
