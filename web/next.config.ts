import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: __dirname },
  // The default locale is an open decision (report section 10). English until then.
  redirects: async () => [{ source: "/", destination: "/en", permanent: false }],
};

export default nextConfig;
