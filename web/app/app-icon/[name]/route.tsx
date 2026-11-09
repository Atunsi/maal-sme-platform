import { appIcon } from "@/lib/app-icon";

// The manifest's icons: /app-icon/192.png, /app-icon/512.png and /app-icon/512-maskable.png, drawn once at
// build time from the logo paths (no image files to keep in step with the logo).
const ICONS = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "512-maskable.png": { size: 512, maskable: true },
} as const;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const icon = ICONS[(await params).name as keyof typeof ICONS];
  if (!icon) return new Response("Not found", { status: 404 });
  return appIcon(icon.size, { maskable: icon.maskable });
}
