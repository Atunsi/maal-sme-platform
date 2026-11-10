import { ImageResponse } from "next/og";
import { AR_BODY, AR_MADDA, AR_VIEWBOX } from "@/components/brand/logoPaths";

/** The installed app's colours: the brand indigo of the solid buttons, the logo in white. */
export const APP_BRAND = "#2e3192";

/**
 * The home-screen icon: Faris's Arabic logo, white on the brand indigo. A maskable icon keeps the logo inside
 * the central 80% safe zone, because Android crops it to a circle or a squircle; the plain one fills more.
 */
export function appIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  const [, , w, h] = AR_VIEWBOX.split(" ").map(Number) as [number, number, number, number];
  const logoH = Math.round(size * (maskable ? 0.46 : 0.6));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: APP_BRAND }}>
        <svg width={Math.round((logoH * w) / h)} height={logoH} viewBox={AR_VIEWBOX}>
          <path fill="#ffffff" fillRule="evenodd" d={AR_BODY} />
          <path fill="#ffffff" d={AR_MADDA} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
