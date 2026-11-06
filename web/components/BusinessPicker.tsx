"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isServingId } from "@/lib/population";

type Props = {
  locale: "en" | "ar";
  /** Carried onto the opened page, so the demo role stays in the URL. */
  query?: string;
  labels: { input: string; help: string; submit: string; invalid: string };
};

export function BusinessPicker({ locale, query = "", labels }: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function open(event: React.FormEvent) {
    event.preventDefault();
    const id = Number(value.trim());
    if (value.trim() === "" || !isServingId(id)) {
      setInvalid(true);
      return;
    }
    router.push(`/${locale}/business/${id}${query}`);
  }

  return (
    <form role="search" onSubmit={open} noValidate className="max-w-sm">
      <label htmlFor="business-id" className="block text-sm font-medium">
        {labels.input}
      </label>
      <p id="business-id-help" className="text-[13px] text-muted">
        {labels.help}
      </p>
      <div className="mt-1.5 flex gap-2.5">
        <input
          id="business-id"
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          value={value}
          aria-describedby={invalid ? "business-id-help business-id-error" : "business-id-help"}
          aria-invalid={invalid}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          className="field w-44 font-mono"
        />
        <button type="submit" className="solid-btn">
          {labels.submit}
        </button>
      </div>
      {invalid && (
        <p id="business-id-error" role="alert" className="mt-2 text-sm text-bad">
          {labels.invalid}
        </p>
      )}
    </form>
  );
}
