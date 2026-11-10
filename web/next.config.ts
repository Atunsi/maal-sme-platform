import type { NextConfig } from "next";

// MAAL_STATIC=1 builds the online demo snapshot (lib/static-data.ts): plain files for GitHub Pages, read from
// API responses captured at build time, served under MAAL_BASE_PATH (the repository's Pages path).
const STATIC = process.env.MAAL_STATIC === "1";
const BASE = process.env.MAAL_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
    // A static export can run no server action: the snapshot swaps in browser-side stand-ins.
    resolveAlias: STATIC ? { "@/app/actions": "./lib/static-actions.ts", "@/app/[locale]/scenarios/custom/actions": "./lib/static-custom-actions.ts" } : {},
  },
  ...(STATIC
    ? { output: "export", distDir: ".next-static", basePath: BASE, trailingSlash: true, images: { unoptimized: true }, env: { MAAL_SITE_STATIC: "1", MAAL_SITE_BASE: BASE } }
    : {
        // The default locale is an open decision (report section 10). English until then.
        redirects: async () => [{ source: "/", destination: "/en", permanent: false }],
      }),
};

export default nextConfig;
