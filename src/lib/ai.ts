import "server-only";

/** The AI Gateway is optional: the app works without it, using on-device parsing only. */
export const aiConfigured = () => !!(process.env.NEON_AI_GATEWAY_TOKEN && process.env.NEON_AI_GATEWAY_BASE_URL);

/** Fast, cheap model that is good at extraction. Override with AI_MODEL (any Neon AI Gateway model id). */
export const aiModelId = () => process.env.AI_MODEL || "claude-haiku-4-5";
