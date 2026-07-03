export const MAX_PLAYER_NAME_LENGTH = 50;
export const MAX_AVATAR_URL_LENGTH = 2048;

export function validatePlayerName(value: unknown): { value?: string; error?: string } {
  if (typeof value !== "string") return { error: "Name is required" };

  const name = value.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Name is required" };
  if (name.length > MAX_PLAYER_NAME_LENGTH) {
    return { error: `Name must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer` };
  }

  return { value: name };
}

export function validateAvatarUrl(value: unknown): { value?: string | null; error?: string } {
  if (value == null || value === "") return { value: null };
  if (typeof value !== "string") return { error: "Avatar URL must be a string" };

  const avatar = value.trim();
  if (!avatar) return { value: null };
  if (avatar.length > MAX_AVATAR_URL_LENGTH) return { error: "Avatar URL is too long" };

  try {
    const url = new URL(avatar);
    const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalHttp) {
      return { error: "Avatar URL must use https" };
    }
  } catch {
    return { error: "Avatar URL is invalid" };
  }

  return { value: avatar };
}
