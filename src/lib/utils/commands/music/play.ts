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

import {
	ActionRowBuilder,
	ContainerBuilder,
	SelectMenuBuilder,
	SelectMenuOptionBuilder,
	TextDisplayBuilder,
} from "@discordjs/builders";
import { parsers } from "@utils/index";
import type { User } from "discord.js";
import type { Riffy, Track } from "riffy";

import {
	ENABLED_MUSIC_SOURCES,
	MUSIC_CONFIG,
	MUSIC_SOURCES,
	type MusicSearchSource,
} from "@/config";

import { createMusicStatusContainer } from "./status";

export {
	createMusicStatusContainer,
	ENABLED_MUSIC_SOURCES as SUPPORTED_SOURCES,
	type MusicSearchSource,
};

export function getDefaultSearchPlatform(): MusicSearchSource {
	const isDefaultEnabled = ENABLED_MUSIC_SOURCES.some(
		(source) => source.value === MUSIC_CONFIG.defaultSearchPlatform,
	);
	if (isDefaultEnabled) {
		return MUSIC_CONFIG.defaultSearchPlatform;
	}
	return (
		ENABLED_MUSIC_SOURCES[0]?.value ?? MUSIC_CONFIG.defaultSearchPlatform
	);
}

export function getSourceName(source: string): string {
	const found = MUSIC_SOURCES.find((s) => s.value === source);
	return found ? found.label : source;
}

export function extractYouTubeVideoId(url: string): string | null {
	try {
		const parsed = new URL(url);
		const hostname = parsed.hostname.toLowerCase();

		if (hostname === "youtu.be") {
			const id = parsed.pathname.slice(1).split("/")[0];
			return id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
		}

		if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
			if (parsed.pathname === "/watch") {
				const id = parsed.searchParams.get("v");
				return id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
			}

			const match = /^\/(shorts|live|embed)\/([a-zA-Z0-9_-]+)/.exec(
				parsed.pathname,
			);
			if (match?.[2]) {
				return match[2];
			}
		}

		return null;
	} catch {
		return null;
	}
}

export async function resolveDirectUrl(
	riffy: Riffy,
	query: string,
	requester: User,
) {
	const youtubeVideoId = extractYouTubeVideoId(query);
	if (youtubeVideoId) {
		return riffy.resolve({
			query: youtubeVideoId,
			source: "ytsearch",
			requester,
		});
	}

	return riffy.resolve({
		query,
		requester,
	});
}

export function createTrackEnqueuedContainer(options: {
	type: "track" | "playlist";
	title: string;
	userTag: string;
	count?: number;
	uri?: string;
	playNext?: boolean;
}): ContainerBuilder {
	const checkmark = parsers.getEmoji("checkmark")?.toString() ?? "✅";
	if (options.type === "playlist") {
		const description = options.playNext
			? `Added **${options.count ?? 0}** tracks from playlist **\`${options.title}\`** to the front of the queue by **${options.userTag}**.`
			: `Added **${options.count ?? 0}** tracks from playlist **\`${options.title}\`** by **${options.userTag}**.`;

		return new ContainerBuilder().addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`${checkmark}  ${description}`),
		);
	}

	const trackLink = options.uri
		? `[${options.title}](${options.uri})`
		: `\`${options.title}\``;
	const description = options.playNext
		? `Added ${trackLink} to the front of the queue by **${options.userTag}**.`
		: `Added ${trackLink} to the queue by **${options.userTag}**.`;

	return new ContainerBuilder().addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`${checkmark}  ${description}`),
	);
}

export function createTrackSelectContainer(
	query: string,
	source: string,
	trackCount: number,
): ContainerBuilder {
	return new ContainerBuilder().addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`🔍  Found **${trackCount}** results for **"${query}"** on **${getSourceName(source)}**.\nSelect a track from the menu below to add it to the queue.`,
		),
	);
}

export function createTrackSelectRow(
	tracks: Track[],
): ActionRowBuilder<SelectMenuBuilder> {
	const selectMenu = new SelectMenuBuilder()
		.setCustomId("play_track_select")
		.setPlaceholder("Choose a track to play...")
		.addOptions(
			tracks
				.slice(0, MUSIC_CONFIG.searchResultLimit)
				.map((track, index) => {
					const title =
						track.info.title.length > 95
							? `${track.info.title.slice(0, 95)}...`
							: track.info.title;
					const duration = parsers.formatDuration(track.info.length);
					const description =
						`${track.info.author} • ${duration}`.slice(0, 100);

					return new SelectMenuOptionBuilder()
						.setLabel(title)
						.setDescription(description)
						.setValue(String(index));
				}),
		);

	return new ActionRowBuilder<SelectMenuBuilder>().addComponents(selectMenu);
}

export function createSourceSelectRow(
	currentSource: string,
): ActionRowBuilder<SelectMenuBuilder> | null {
	if (ENABLED_MUSIC_SOURCES.length === 0) return null;

	const selectMenu = new SelectMenuBuilder()
		.setCustomId("play_source_select")
		.setPlaceholder("Switch search source...")
		.addOptions(
			ENABLED_MUSIC_SOURCES.map((source) =>
				new SelectMenuOptionBuilder()
					.setLabel(source.label)
					.setValue(source.value)
					.setEmoji({ name: source.emoji })
					.setDefault(source.value === currentSource),
			),
		);

	return new ActionRowBuilder<SelectMenuBuilder>().addComponents(selectMenu);
}
