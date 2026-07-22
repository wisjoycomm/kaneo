import { normalizeGitlabBaseUrl } from "../config";

// GitLab's project.web_url is "https://gitlab.example.com/owner/repo" — the
// instance base URL is everything before the last two path segments, same
// shape as Gitea's html_url.
export function baseUrlFromProjectWebUrl(webUrl: string): string {
  try {
    const u = new URL(webUrl);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return "";
    }

    const basePathSegments = segments.slice(0, -2);
    const basePath =
      basePathSegments.length > 0 ? `/${basePathSegments.join("/")}` : "";

    return normalizeGitlabBaseUrl(`${u.origin}${basePath}`);
  } catch {
    return "";
  }
}
