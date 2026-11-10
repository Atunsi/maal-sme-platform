import { AR_BODY, AR_MADDA, AR_VIEWBOX, EN_BODY, EN_MADDA, EN_VIEWBOX } from "@/components/brand/logoPaths";

type Props = {
  height: number;
  color?: string;
  /** With a label the logo is an image with that name. Without one it is decoration. */
  label?: string;
  /** The entrance motion: the body rises, then the madda lands. */
  animate?: boolean;
  className?: string;
};

type Art = { viewBox: string; body: string; madda: string; late?: boolean };

function Logo({ viewBox, body, madda, late, height, color = "currentColor", label, animate, className }: Props & Art) {
  const [, , w, h] = viewBox.split(" ").map(Number) as [number, number, number, number];
  const motion = (name: string) => (animate ? `${name}${late ? " lg-late" : ""}` : undefined);
  return (
    <svg
      width={(height * w) / h}
      height={height}
      viewBox={viewBox}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{ flex: "none", overflow: "visible" }}
    >
      <path className={motion("lg-body")} fill={color} fillRule="evenodd" d={body} />
      <path className={motion("lg-madda")} fill={color} d={madda} />
    </svg>
  );
}

/** Faris's Arabic wordmark, the master logo. */
export function ArabicLogo(props: Props) {
  return <Logo {...props} viewBox={AR_VIEWBOX} body={AR_BODY} madda={AR_MADDA} />;
}

/** The English wordmark. Its entrance runs 0.2 s after the Arabic. */
export function EnglishWordmark(props: Props) {
  return <Logo {...props} viewBox={EN_VIEWBOX} body={EN_BODY} madda={EN_MADDA} late />;
}

/** The band of small logos that drifts under the header and between landing sections. */
export function LogoBand({ onDark }: { onDark?: boolean }) {
  return <div aria-hidden="true" className={`weave${onDark ? " ondark" : ""}`} />;
}

/** The small logo before a section label. */
export function SectionMark({ onDark }: { onDark?: boolean }) {
  return <span aria-hidden="true" className={`mk${onDark ? " ondark" : ""}`} />;
}
