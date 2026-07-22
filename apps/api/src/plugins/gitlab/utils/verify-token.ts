import { timingSafeEqual } from "node:crypto";

// GitLab webhooks authenticate with a plain shared secret sent verbatim in the
// X-Gitlab-Token header (no HMAC signature like GitHub/Gitea).
export function verifyGitlabToken(
  secret: string,
  tokenHeader: string | undefined,
): boolean {
  if (!tokenHeader || !secret) {
    return false;
  }

  const a = Buffer.from(tokenHeader);
  const b = Buffer.from(secret);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
