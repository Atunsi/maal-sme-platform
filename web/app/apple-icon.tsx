import { appIcon } from "@/lib/app-icon";

// The icon iOS puts on the home screen when the app is added there (apple-touch-icon). iOS rounds the
// corners itself, so the square is full bleed.
export const dynamic = "force-static";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}
