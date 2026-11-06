"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isServingId } from "@/lib/population";

type Props = {
  locale: "en" | "ar";
  labels: { input: string; help: string; submit: string; invalid: string };
};

export function BusinessPicker({ locale, labels }: Props) {
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
    router.push(`/${locale}/business/${id}`);
  }

  return (
    <form onSubmit={open} noValidate className="max-w-sm">
      <label htmlFor="business-id" className="block font-medium">
        {labels.input}
      </label>
      <p id="business-id-help" className="text-sm text-muted">
        {labels.help}
      </p>
      <div className="mt-2 flex gap-2">
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
          className="w-36 rounded border border-muted bg-card px-3 py-2"
        />
        <button type="submit" className="rounded bg-brand px-4 py-2 font-medium text-white">
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
