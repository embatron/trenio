import { useEffect, useRef, type InputHTMLAttributes } from "react";

import {
  BY_PHONE_COUNTRY_PREFIX,
  belarusPhoneCaret,
  clampBelarusPhoneSelection,
  constrainBelarusPhoneInput,
} from "@/lib/auth/phone";

const PREFIX = BY_PHONE_COUNTRY_PREFIX.length;

/** A Belarus mobile field. `+375` is always in the value, and the caret cannot move in front of it. */
export function BelarusPhoneInput({
  value,
  onValue,
  readOnly,
  focusCaret = 0,
  ...rest
}: {
  value: string;
  onValue: (value: string) => void;
  readOnly?: boolean;
  /** Raise this to focus the field and put the caret right after `+375`. */
  focusCaret?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "readOnly">) {
  const ref = useRef<HTMLInputElement>(null);
  const shown = constrainBelarusPhoneInput(value || BY_PHONE_COUNTRY_PREFIX);

  useEffect(() => {
    if (!focusCaret || readOnly) return;
    const node = ref.current;
    if (!node) return;
    node.focus();
    const at = belarusPhoneCaret(node.value);
    node.setSelectionRange(at, at);
  }, [focusCaret, readOnly]);

  function guard(node: HTMLInputElement) {
    const next = clampBelarusPhoneSelection(node.selectionStart ?? 0, node.selectionEnd ?? 0);
    if (next.start !== node.selectionStart || next.end !== node.selectionEnd) {
      node.setSelectionRange(next.start, next.end);
    }
  }

  return (
    <input
      {...rest}
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete={rest.autoComplete ?? "tel"}
      readOnly={readOnly}
      value={shown}
      onFocus={(event) => {
        if (!readOnly) guard(event.currentTarget);
        rest.onFocus?.(event);
      }}
      onClick={(event) => {
        if (!readOnly) guard(event.currentTarget);
        rest.onClick?.(event);
      }}
      onKeyUp={(event) => {
        if (!readOnly) guard(event.currentTarget);
        rest.onKeyUp?.(event);
      }}
      onSelect={(event) => {
        if (!readOnly) guard(event.currentTarget);
        rest.onSelect?.(event);
      }}
      onKeyDown={(event) => {
        if (!readOnly) {
          const node = event.currentTarget;
          const start = node.selectionStart ?? 0;
          const end = node.selectionEnd ?? 0;
          if ((event.key === "Backspace" || event.key === "Delete") && end <= PREFIX) {
            event.preventDefault();
          } else if (
            (event.key === "Backspace" || event.key === "Delete") &&
            start < PREFIX &&
            end > PREFIX
          ) {
            event.preventDefault();
            const next = constrainBelarusPhoneInput(
              node.value.slice(0, PREFIX) + node.value.slice(end),
            );
            onValue(next);
            requestAnimationFrame(() => {
              const current = ref.current;
              if (!current) return;
              const at = belarusPhoneCaret(current.value);
              current.setSelectionRange(at, at);
            });
          } else if (event.key === "ArrowLeft" && start <= PREFIX && end <= PREFIX) {
            event.preventDefault();
          } else if (event.key === "Home") {
            event.preventDefault();
            const at = belarusPhoneCaret(node.value);
            node.setSelectionRange(at, at);
          }
        }
        rest.onKeyDown?.(event);
      }}
      onChange={(event) => {
        if (readOnly) return;
        const next = constrainBelarusPhoneInput(event.target.value);
        onValue(next);
        requestAnimationFrame(() => {
          const current = ref.current;
          if (!current || document.activeElement !== current) return;
          const pos = current.selectionStart ?? next.length;
          if (pos < PREFIX) current.setSelectionRange(PREFIX, PREFIX);
        });
      }}
    />
  );
}
