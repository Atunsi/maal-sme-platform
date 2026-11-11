"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { RegistrationField } from "@/components/RegistrationField";
import { DEMO_BUSINESS } from "@/lib/businesses";
import { fill, type Locale, type Messages } from "@/lib/i18n";
import { checkRegistrationNumber, type DemoNumbers, type RegistrationProblem } from "@/lib/registrationNumber";

type Role = "owner" | "admin";

/** The demo password for both roles. It is checked in the browser only, so it protects nothing. */
export const DEMO_PASSWORD = "pass";

/**
 * A demo sign-in (DECISIONS 42, amended by DECISIONS 62). The password is read only to compare it with the demo
 * password, and the username is not read at all. The owner's commercial registration number is checked in the
 * browser (CR1) and only chooses which demo business opens: it becomes part of that page's address and nothing
 * else. The form creates no account, stores nothing and sends nothing.
 */
export function SignInForm({ locale, s, r, demo }: { locale: Locale; s: Messages["signIn"]; r: Messages["registration"]; demo: DemoNumbers }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("owner");
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const [number, setNumber] = useState("");
  const [problem, setProblem] = useState<RegistrationProblem | null>(null);
  const numberField = useRef<HTMLInputElement>(null);

  function enter(event: FormEvent) {
    event.preventDefault();
    let business: number = DEMO_BUSINESS;
    if (role === "owner") {
      // CR1: the number is checked before anything else, and a refused number puts focus back on its field.
      const check = checkRegistrationNumber(number, demo);
      if (!check.ok) {
        setProblem(check.problem);
        numberField.current?.focus();
        return;
      }
      business = check.id;
    }
    if (password !== DEMO_PASSWORD) {
      setWrong(true);
      return;
    }
    router.push(role === "owner" ? `/${locale}/business/${business}?as=owner` : `/${locale}/admin?as=admin`);
  }

  const roleButton = (value: Role, name: string, hint: string) => (
    <button
      type="button"
      aria-pressed={role === value}
      onClick={() => setRole(value)}
      className={`min-h-16 cursor-pointer border-0 px-3.5 py-2.5 text-start text-label transition-colors ${role === value ? "text-white" : "bg-transparent text-ink"}`}
    >
      <span className="block font-semibold">{name}</span>
      <span className="block text-label opacity-80">{hint}</span>
    </button>
  );

  return (
    <>
      <div role="group" aria-label={s.roleGroup} data-thumb={role === "owner" ? "start" : "end"} className="segmented rise clip-box grid grid-cols-2 border border-ink" style={{ animationDelay: "0.45s" }}>
        {/* MT4 (DECISIONS 60): the thumb is decoration; the pressed button and its label carry the state. */}
        <span aria-hidden="true" className="segmented-thumb bg-solid" />
        {roleButton("owner", s.owner, s.ownerHint)}
        {roleButton("admin", s.admin, s.adminHint)}
      </div>
      <form onSubmit={enter} autoComplete="off" className="rise flex flex-col gap-4.5" style={{ animationDelay: "0.6s" }}>
        {role === "owner" ? (
          // X3, CR2: the hint is visible text under the label, never a placeholder.
          <RegistrationField r={r} demo={demo} demoNumber={DEMO_BUSINESS} value={number} onValue={setNumber} problem={problem} onProblem={setProblem} inputRef={numberField} />
        ) : (
          <label className="flex flex-col gap-1.5 text-label font-medium">
            {s.username}
            <input type="text" dir="ltr" autoComplete="off" className="field" />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-label font-medium">
          {s.password}
          <input
            type="password"
            dir="ltr"
            autoComplete="off"
            className="field"
            value={password}
            aria-invalid={wrong || undefined}
            aria-describedby={wrong ? "sign-in-demo-password sign-in-wrong" : "sign-in-demo-password"}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
              setWrong(false);
            }}
          />
        </label>
        {/* B1: the password protects nothing (DECISIONS 42), so the page says what it is. */}
        <p id="sign-in-demo-password" className="-mt-2.5 text-label text-muted">
          {fill(s.demoPassword, { password: DEMO_PASSWORD })}
        </p>
        {wrong && (
          <p id="sign-in-wrong" role="alert" className="text-label font-medium text-bad">
            {s.wrongPassword}
          </p>
        )}
        <button type="submit" className="solid-btn cta min-h-[52px] text-body">
          {role === "owner" ? s.ctaOwner : s.ctaAdmin}
        </button>
      </form>
    </>
  );
}
