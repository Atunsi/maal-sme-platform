import { apiEnv } from "./helpers";

export default async function globalSetup() {
  const res = await fetch(`${apiEnv().MAAL_API_URL}/health`).catch(() => null);
  if (!res?.ok) throw new Error("The Python API is not running. Start it first; see web/README.md.");
}
