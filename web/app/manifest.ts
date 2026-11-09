import type { MetadataRoute } from "next";
import { APP_BRAND } from "@/lib/app-icon";
import { TOUR_STEPS, tourHref } from "@/lib/tour";

// The installed app (the app variant): the same pages, opened full screen from the home screen with the
// brand icon and an indigo launch screen. It opens at sign-in, as an app would, not at the landing page.
export const dynamic = "force-static";

// The online snapshot is served under a repository path (next.config.ts basePath); the manifest's own URLs
// are not rewritten by Next.js, so they carry it here.
const BASE = process.env.MAAL_SITE_BASE ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    name: "Ma'al: where your business is heading",
    short_name: "Ma'al",
    description: "SME financial health, Sharia-aware. A demo on synthetic data.",
    start_url: `${BASE}/en/sign-in`,
    scope: `${BASE}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: APP_BRAND,
    theme_color: APP_BRAND,
    lang: "en",
    dir: "ltr",
    categories: ["finance", "business"],
    icons: [
      { src: `${BASE}/app-icon/192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}/app-icon/512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE}/app-icon/512-maskable.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Take the tour", url: `${BASE}${tourHref("en", TOUR_STEPS[0]!, null)}` },
      { name: "Scenarios", url: `${BASE}/en/scenarios` },
      { name: "العربية", url: `${BASE}/ar/sign-in` },
    ],
  };
}
