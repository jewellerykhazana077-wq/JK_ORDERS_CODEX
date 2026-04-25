"use client";

import { useEffect, useRef, useState } from "react";

type Option<T extends string> = {
  label: string;
  value: T;
};

export default function ThemedSelect<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="themed-select" ref={ref}>
      <button
        aria-expanded={open}
        aria-label={label}
        className="themed-select-button"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="themed-select-menu" role="listbox">
          {options.map((option) => (
            <button
              className={option.value === value ? "selected" : ""}
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
