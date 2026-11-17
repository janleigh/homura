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

import { createMusicStatusContainer } from "@commandUtils/music/status";
import type { BaseClient } from "@lib/BaseClient";
import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener, type ListenerOptions } from "@sapphire/framework";
import { parsers } from "@utils/index";
import { clearSkipVotes, recheckSkipVotes } from "@utils/permissions";
import { MessageFlags, type TextChannel, type VoiceState } from "discord.js";

@ApplyOptions<ListenerOptions>({
	once: false,
	event: Events.VoiceStateUpdate,
})
export class VoiceStateUpdateListener extends Listener<
	typeof Events.VoiceStateUpdate
> {
	public async run(oldState: VoiceState, newState: VoiceState) {
		if (
			oldState.channelId === newState.channelId &&
			oldState.deaf === newState.deaf
		) {
			return;
		}

		const client = this.container.client as BaseClient;
		const guild = newState.guild;

		if (newState.id === client.user?.id && !newState.channelId) {
			clearSkipVotes(client, guild.id);
			return;
		}

		const votes = client.skipVotes.get(guild.id);
		if (!votes || votes.size === 0) return;

		const player = client.riffy.players.get(guild.id);
		const track = player?.current;
		if (!player || !track) {
			clearSkipVotes(client, guild.id);
			return;
		}

		const botVoiceId =
			guild.members.me?.voice.channelId ?? player.voiceChannel ?? null;
		if (
			!botVoiceId ||
			(oldState.channelId !== botVoiceId &&
				newState.channelId !== botVoiceId)
		) {
			return;
		}

		const result = recheckSkipVotes({ client, guild, player });
		if (!result?.passed) return;

		const channel = client.channels.cache.get(player.textChannel) as
			| TextChannel
			| undefined;
		if (!channel) return;

		const trackLink = track.info.uri
			? `[${track.info.title}](${track.info.uri})`
			: `**${track.info.title}**`;
		const checkmark = parsers.getEmoji("checkmark")?.toString() ?? "⏭️";

		await channel.send({
			components: [
				createMusicStatusContainer(
					`Vote skip passed (**${result.votes}/${result.required}**)! Skipped ${trackLink}`,
					checkmark,
				),
			],
			flags: MessageFlags.IsComponentsV2,
		});
	}
}
