"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DEMO_BUSINESS } from "@/lib/businesses";
import type { Locale, Messages } from "@/lib/i18n";

type Role = "owner" | "admin";

/** The demo password for both roles. It is checked in the browser only, so it protects nothing. */
export const DEMO_PASSWORD = "pass";

/**
 * A demo sign-in (DECISIONS 42). Only the password is read, and only to compare it with the demo
 * password; the registration number and username are not read at all. It creates no account,
 * stores nothing and sends nothing.
 */
export function SignInForm({ locale, s }: { locale: Locale; s: Messages["signIn"] }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("owner");
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);

  function enter(event: FormEvent) {
    event.preventDefault();
    if (password !== DEMO_PASSWORD) {
      setWrong(true);
      return;
    }
    router.push(role === "owner" ? `/${locale}/business/${DEMO_BUSINESS}?as=owner` : `/${locale}/admin?as=admin`);
  }

  const roleButton = (value: Role, name: string, hint: string) => (
    <button
      type="button"
      aria-pressed={role === value}
      onClick={() => setRole(value)}
      className={`min-h-16 cursor-pointer border-0 px-3.5 py-2.5 text-start text-sm transition-colors ${role === value ? "bg-solid text-white" : "bg-transparent text-ink"}`}
    >
      <span className="block font-semibold">{name}</span>
      <span className="block text-xs opacity-80">{hint}</span>
    </button>
  );

  return (
    <>
      <div role="group" aria-label={s.roleGroup} className="rise clip-box grid grid-cols-2 border border-ink" style={{ animationDelay: "0.45s" }}>
        {roleButton("owner", s.owner, s.ownerHint)}
        {roleButton("admin", s.admin, s.adminHint)}
      </div>
      <form onSubmit={enter} autoComplete="off" className="rise flex flex-col gap-4.5" style={{ animationDelay: "0.6s" }}>
        {role === "owner" ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {s.cr}
            <input type="text" inputMode="numeric" dir="ltr" placeholder={s.crHint} autoComplete="off" className="field font-mono" />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {s.username}
            <input type="text" dir="ltr" autoComplete="off" className="field" />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {s.password}
          <input
            type="password"
            dir="ltr"
            autoComplete="off"
            className="field"
            value={password}
            aria-invalid={wrong || undefined}
            aria-describedby={wrong ? "sign-in-wrong" : undefined}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
              setWrong(false);
            }}
          />
        </label>
        {wrong && (
          <p id="sign-in-wrong" role="alert" className="text-sm font-medium text-bad">
            {s.wrongPassword}
          </p>
        )}
        <button type="submit" className="solid-btn cta min-h-[52px] text-base">
          {role === "owner" ? s.ctaOwner : s.ctaAdmin}
        </button>
      </form>
    </>
  );
}
