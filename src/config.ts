/**
 *  Copyright (C) 2026 Jan Leigh Muñoz
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published
 *  by the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { BucketScope, LogLevel } from "@sapphire/framework";
import {
	ActivityType,
	type ClientOptions,
	type GatewayIntentsString,
	type PresenceData,
} from "discord.js";

import { env } from "@/env";

/**
 * @description The dev server IDs. The only places where developer commands will be registered.
 * @type {string[]}
 */
export const DEV_SERVER_IDS: string[] = ["1543805959636516864"];

/**
 * @description The dev user IDs. The only users who can use developer commands.
 * @type {string[]}
 */
export const DEV_USER_IDS: string[] = ["359641658654064641"];

/**
 * @description The priveledged intents to be used by the bot.
 * @type {GatewayIntentsString[]}
 */
const INTENTS: GatewayIntentsString[] = [
	"Guilds",
	"GuildMembers",
	"GuildMessages",
	"GuildMessageReactions",
	"GuildEmojisAndStickers",
	"GuildVoiceStates",
	"MessageContent",
];

/**
 * @description The default client options.
 * @type {ClientOptions}
 */
export const CLIENT_OPTIONS: ClientOptions = {
	intents: INTENTS,
	allowedMentions: { parse: ["users", "roles"], repliedUser: true },
	defaultCooldown: {
		delay: 10_000,
		filteredUsers: DEV_USER_IDS,
		limit: 2,
		scope: BucketScope.User,
	},
	defaultPrefix: "/",
	loadMessageCommandListeners: true,
	enableLoaderTraceLoggings: true,
	logger: {
		level: env.NODE_ENV === "production" ? LogLevel.Info : LogLevel.Debug,
	},
};

/**
 * @description The presence data for the bot.
 * @type {PresenceData}
 */
export const PRESENCE_OPTIONS: PresenceData = {
	activities: [
		{
			name: "M2 to parry | /help",
			type: ActivityType.Playing,
		},
	],
	status: "idle",
};

/**
 * @description The Lavalink nodes to be used by the bot.
 * Configure youtubePlaylistLoadLimit on a self-hosted node to load larger playlists.
 */
export const LAVALINK_NODES = [
	{
		host: env.LAVALINK_HOST,
		port: env.LAVALINK_PORT,
		password: env.LAVALINK_PASSWORD,
		secure: env.LAVALINK_SECURE,
	},
];

/**
 * @description The emoji IDs for the bot.
 * Now, uses application emojis. Set up those in the Discord Developer Portal.
 * @type {Record<string, string>}
 */
export const EMOJI_IDS: Record<string, string> = {
	crossmark: "1543833839707885578",
	checkmark: "1543833834859274280",
	greytick: "1564170872800022579",
};

/**
 * @description Whether to turn off announcing the built-in events
 * @type {Record<string, boolean>}
 */
export const LAVALINK_EVENTS: Record<string, boolean> = {
	queueEnd: true,
	trackStart: false,
};

export interface MusicSource {
	label: string;
	value: string;
	emoji: string;
	enabled: boolean;
}

/**
 * @description Supported music search sources for Riffy and play commands.
 */
export const MUSIC_SOURCES = [
	{ label: "YouTube Music", value: "ytmsearch", emoji: "🎵", enabled: true },
	{ label: "YouTube", value: "ytsearch", emoji: "▶️", enabled: true },
	{ label: "Spotify", value: "spsearch", emoji: "🟢", enabled: false },
	{ label: "SoundCloud", value: "scsearch", emoji: "☁️", enabled: true },
] as const satisfies readonly MusicSource[];

export const ENABLED_MUSIC_SOURCES = MUSIC_SOURCES.filter(
	(source) => source.enabled,
);

export type MusicSearchSource = (typeof MUSIC_SOURCES)[number]["value"];

/**
 * @description Music playback, search, and pagination defaults.
 */
export const MUSIC_CONFIG = {
	defaultSearchPlatform: "ytmsearch" as MusicSearchSource,
	maxVolume: 150,
	voteSkipThreshold: 0.5,
	queuePageSize: 10,
	searchResultLimit: 10,
};
