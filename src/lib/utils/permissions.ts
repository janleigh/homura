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

import type { BaseClient } from "@lib/BaseClient";
import type { GuildConfig } from "@lib/database";
import {
	Collection,
	type Guild,
	type GuildMember,
	PermissionFlagsBits,
} from "discord.js";
import type { Player, Track } from "riffy";

import { MUSIC_CONFIG } from "@/config";

export interface SkipActionResult {
	status: "skipped" | "vote_passed" | "voted" | "already_voted";
	votes: number;
	required: number;
}

export interface VoteSkipCheckResult {
	passed: boolean;
	votes: number;
	required: number;
}

export function getRequesterId(track: Track | null | undefined): string | null {
	const requester = track?.info?.requester as { id?: unknown } | undefined;
	return typeof requester?.id === "string" ? requester.id : null;
}

export function getActiveListeners(
	guild: Guild,
	voiceChannelId: string | null | undefined,
): Collection<string, GuildMember> {
	if (!voiceChannelId) return new Collection();

	const channel = guild.channels.cache.get(voiceChannelId);
	if (!channel?.isVoiceBased()) return new Collection();

	return channel.members.filter(
		(member) => !member.user.bot && !member.voice.deaf,
	);
}

export function isMemberDJ(
	member: GuildMember,
	guild: Guild,
	config: GuildConfig,
	botVoiceChannelId?: string | null,
): boolean {
	if (
		member.permissions.has(PermissionFlagsBits.ManageGuild) ||
		member.permissions.has(PermissionFlagsBits.Administrator)
	) {
		return true;
	}

	if (config.djRoles.some((roleId) => member.roles.cache.has(roleId))) {
		return true;
	}

	const resolvedBotVoiceId =
		botVoiceChannelId ?? guild.members.me?.voice.channelId;

	if (
		resolvedBotVoiceId &&
		member.voice.channelId === resolvedBotVoiceId &&
		getActiveListeners(guild, resolvedBotVoiceId).size <= 1
	) {
		return true;
	}

	return false;
}

export function canRunMusicCommand(
	member: GuildMember,
	guild: Guild,
	config: GuildConfig,
	commandName: string,
	botVoiceChannelId?: string | null,
): boolean {
	if (!config.djEnabled || !config.djCommands.includes(commandName)) {
		return true;
	}

	return isMemberDJ(member, guild, config, botVoiceChannelId);
}

export function clearSkipVotes(client: BaseClient, guildId: string): void {
	client.skipVotes.delete(guildId);
}

function getRequiredSkipVotes(activeListenerCount: number): number {
	return Math.max(
		1,
		Math.ceil(activeListenerCount * MUSIC_CONFIG.voteSkipThreshold),
	);
}

function pruneStaleSkipVotes(
	votes: Set<string>,
	activeListeners: Collection<string, GuildMember>,
): void {
	for (const voterId of votes) {
		if (!activeListeners.has(voterId)) {
			votes.delete(voterId);
		}
	}
}

export function recheckSkipVotes(options: {
	client: BaseClient;
	guild: Guild;
	player: Player;
}): VoteSkipCheckResult | null {
	const { client, guild, player } = options;
	const votes = client.skipVotes.get(guild.id);
	if (!votes || votes.size === 0) return null;

	const botVoiceId =
		guild.members.me?.voice.channelId ?? player.voiceChannel ?? null;
	if (!botVoiceId || !player.current) {
		clearSkipVotes(client, guild.id);
		return null;
	}

	const activeListeners = getActiveListeners(guild, botVoiceId);
	pruneStaleSkipVotes(votes, activeListeners);

	if (votes.size === 0) {
		clearSkipVotes(client, guild.id);
		return null;
	}

	const required = getRequiredSkipVotes(activeListeners.size);
	if (votes.size >= required) {
		const finalVotes = votes.size;
		clearSkipVotes(client, guild.id);
		player.stop();
		return { passed: true, votes: finalVotes, required };
	}

	return { passed: false, votes: votes.size, required };
}

export function handleSkipAction(options: {
	client: BaseClient;
	guild: Guild;
	member: GuildMember;
	player: Player;
}): SkipActionResult {
	const { client, guild, member, player } = options;
	const config = client.db.getGuildConfig(guild.id);
	const track = player.current;
	const botVoiceId =
		guild.members.me?.voice.channelId ?? player.voiceChannel ?? null;

	const isRequester = getRequesterId(track) === member.id;

	if (
		!config.djEnabled ||
		!config.djCommands.includes("skip") ||
		isRequester ||
		isMemberDJ(member, guild, config, botVoiceId)
	) {
		clearSkipVotes(client, guild.id);
		player.stop();
		return { status: "skipped", votes: 0, required: 0 };
	}

	const activeListeners = getActiveListeners(guild, botVoiceId);
	const required = getRequiredSkipVotes(activeListeners.size);

	if (required <= 1) {
		clearSkipVotes(client, guild.id);
		player.stop();
		return { status: "skipped", votes: 1, required: 1 };
	}

	let votes = client.skipVotes.get(guild.id);
	if (!votes) {
		votes = new Set();
		client.skipVotes.set(guild.id, votes);
	}

	pruneStaleSkipVotes(votes, activeListeners);

	if (votes.has(member.id)) {
		return { status: "already_voted", votes: votes.size, required };
	}

	votes.add(member.id);

	if (votes.size >= required) {
		const finalVotes = votes.size;
		clearSkipVotes(client, guild.id);
		player.stop();
		return { status: "vote_passed", votes: finalVotes, required };
	}

	return { status: "voted", votes: votes.size, required };
}
