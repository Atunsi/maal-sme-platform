/** The landing page's flow picture: numbered steps joined by lines with travelling dots. Text comes in. */
export function Flow({ steps }: { steps: readonly { title: string; text: string }[] }) {
  const pad = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <div className="flex flex-wrap items-stretch">
      {steps.map((step, i) => (
        <div key={step.title} className="contents">
          <div className="rise flex min-w-0 flex-[1_1_200px] flex-col gap-2 border border-line bg-card p-5" style={{ animationDelay: `${(0.2 + i * 0.2).toFixed(1)}s` }}>
            <span className="font-mono text-xs text-muted">{pad(i)}</span>
            <span className="heading text-[22px]">{step.title}</span>
            <span className="text-sm text-muted">{step.text}</span>
          </div>
          {i < steps.length - 1 && (
            <div aria-hidden="true" className="flowline">
              <span className="dot" style={{ animationDelay: `${(i * 0.6).toFixed(1)}s` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
