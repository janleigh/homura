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
import { ApplyOptions } from "@sapphire/decorators";
import {
	type ChatInputCommand,
	Command,
	RegisterBehavior,
} from "@sapphire/framework";
import { parsers } from "@utils/index";
import { handleSkipAction } from "@utils/permissions";
import { MessageFlags } from "discord.js";

@ApplyOptions<Command.Options>({
	name: "skip",
	description: "Skip the currently playing track",
	fullCategory: ["Music"],
	preconditions: [
		"HasActivePlayerPrecondition",
		"HasPlayingTrackPrecondition",
		"InVoiceChannelPrecondition",
		"SameVoiceChannelPrecondition",
		"DJPrecondition",
	],
})
export class SkipCommand extends Command {
	public override registerApplicationCommands(
		registry: ChatInputCommand.Registry,
	) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName("skip")
					.setDescription("Skip the currently playing track"),
			{ behaviorWhenNotIdentical: RegisterBehavior.Overwrite },
		);
	}

	public async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const guild = interaction.guild!;
		const member =
			guild.members.cache.get(interaction.user.id) ??
			(await guild.members.fetch(interaction.user.id));
		const player = this.container.client.riffy.players.get(guild.id)!;
		const track = player.current!;
		const trackLink = track.info.uri
			? `[${track.info.title}](${track.info.uri})`
			: `**${track.info.title}**`;

		const result = handleSkipAction({
			client: this.container.client,
			guild,
			member,
			player,
		});

		if (result.status === "skipped") {
			return interaction.reply({
				components: [
					createMusicStatusContainer(`Skipped ${trackLink}`, "⏭️"),
				],
				flags: MessageFlags.IsComponentsV2,
			});
		}

		if (result.status === "vote_passed") {
			const checkmark = parsers.getEmoji("checkmark")?.toString() ?? "⏭️";
			return interaction.reply({
				components: [
					createMusicStatusContainer(
						`Vote skip passed (**${result.votes}/${result.required}**)! Skipped ${trackLink}`,
						checkmark,
					),
				],
				flags: MessageFlags.IsComponentsV2,
			});
		}

		if (result.status === "already_voted") {
			const crossmark = parsers.getEmoji("crossmark")?.toString() ?? "⚠️";
			return interaction.reply({
				components: [
					createMusicStatusContainer(
						`You have already voted to skip this track (**${result.votes}/${result.required}** votes).`,
						crossmark,
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		const greytick = parsers.getEmoji("greytick")?.toString() ?? "🗳️";
		return interaction.reply({
			components: [
				createMusicStatusContainer(
					`Voted to skip ${trackLink} (**${result.votes}/${result.required}** votes needed).`,
					greytick,
				),
			],
			flags: MessageFlags.IsComponentsV2,
		});
	}
}
