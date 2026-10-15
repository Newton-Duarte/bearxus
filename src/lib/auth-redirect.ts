export function getAuthRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  try {
    if (/[\\\u0000-\u0020]/.test(value)) return "/dashboard";
    const url = new URL(value, "https://bearxus.invalid");
    const decodedPath = decodeURIComponent(url.pathname);
    if (/[\\\u0000-\u0020]/.test(decodedPath) || decodedPath.startsWith("//") || /%[0-9a-f]{2}/i.test(decodedPath)) return "/dashboard";
    const path = new URL(decodedPath, "https://bearxus.invalid").pathname.toLowerCase().replace(/\/+$/, "");
    if (url.origin !== "https://bearxus.invalid" ||
      /^\/(sign-in|register|api)(\/|$)/.test(path)) {
      return "/dashboard";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}
