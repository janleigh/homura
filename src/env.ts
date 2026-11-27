import { z } from "zod";

const envSchema = z.object({
	DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
	NODE_ENV: z.enum(["development", "production"]).default("production"),
	// lavalink
	LAVALINK_HOST: z
		.string()
		.min(1, "LAVALINK_HOST is required")
		.default("lava-v4.ajieblogs.eu.org"),
	LAVALINK_PORT: z.coerce.number().int().min(1).max(65535).default(80),
	LAVALINK_PASSWORD: z
		.string()
		.min(1, "LAVALINK_PASSWORD is required")
		.default("https://dsc.gg/ajidevserver"),
	LAVALINK_SECURE: z
		.enum(["true", "false"])
		.default("false")
		.transform((v) => v === "true"),
});

export const env = envSchema.parse(process.env);
