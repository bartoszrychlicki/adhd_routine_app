const DEFAULT_APP_URL = "http://localhost:3000"

export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE ??
    process.env.SITE_URL ??
    DEFAULT_APP_URL

  return raw.replace(/\/$/, "")
}
