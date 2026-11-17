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
	type ChatInputCommand,
	type Command,
	type ContextMenuCommand,
	type MessageCommand,
	Precondition,
} from "@sapphire/framework";
import { getRequesterId, isMemberDJ } from "@utils/permissions";
import type { Guild, Message } from "discord.js";
import type { Track } from "riffy";

export class DJPrecondition extends Precondition {
	public async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
		command: ChatInputCommand,
	) {
		if (!interaction.guild) {
			return this.error({
				message: "This command can only be used in a server.",
			});
		}

		const config = this.container.client.db.getGuildConfig(
			interaction.guild.id,
		);

		if (!config.djEnabled || !config.djCommands.includes(command.name)) {
			return this.ok();
		}

		// /skip handles DJ, requester, and vote-skip checks directly
		if (command.name === "skip") {
			return this.ok();
		}

		// checking current vol without changing it is allowed for everyone
		if (
			command.name === "volume" &&
			interaction.options.getInteger("level") === null
		) {
			return this.ok();
		}

		const hasDJ = await this.checkDJ(
			interaction.guild,
			interaction.user.id,
		);
		if (hasDJ) {
			return this.ok();
		}

		// users can always remove tracks they requested themselves
		if (command.name === "remove") {
			const player = this.container.client.riffy.players.get(
				interaction.guild.id,
			);
			if (player) {
				const queueItems = Array.from(player.queue) as Track[];
				const position = interaction.options.getInteger("position");
				const count = interaction.options.getInteger("count") ?? 1;

				if (
					position !== null &&
					position >= 1 &&
					position <= queueItems.length
				) {
					const targets = queueItems.slice(
						position - 1,
						position - 1 + count,
					);
					if (
						targets.length > 0 &&
						targets.every(
							(track) =>
								getRequesterId(track) === interaction.user.id,
						)
					) {
						return this.ok();
					}
				}
			}
		}

		return this.error({
			message:
				"You need a DJ role or Manage Server permission to use this command.",
		});
	}

	public async contextMenuRun(
		interaction: Command.ContextMenuCommandInteraction,
		command: ContextMenuCommand,
	) {
		return this.checkGeneric(
			interaction.guild,
			interaction.user.id,
			command.name,
		);
	}

	public async messageRun(message: Message, command: MessageCommand) {
		return this.checkGeneric(
			message.guild,
			message.author.id,
			command.name,
		);
	}

	private async checkGeneric(
		guild: Guild | null,
		userId: string,
		commandName: string,
	) {
		if (!guild) {
			return this.error({
				message: "This command can only be used in a server.",
			});
		}

		const config = this.container.client.db.getGuildConfig(guild.id);
		if (!config.djEnabled || !config.djCommands.includes(commandName)) {
			return this.ok();
		}

		const hasDJ = await this.checkDJ(guild, userId);
		return hasDJ
			? this.ok()
			: this.error({
					message:
						"You need a DJ role or Manage Server permission to use this command.",
				});
	}

	private async checkDJ(guild: Guild, userId: string): Promise<boolean> {
		const config = this.container.client.db.getGuildConfig(guild.id);
		const member =
			guild.members.cache.get(userId) ??
			(await guild.members.fetch(userId).catch(() => null));

		if (!member) return false;

		const botVoiceChannelId =
			guild.members.me?.voice.channelId ??
			(await guild.members.fetchMe().catch(() => null))?.voice
				.channelId ??
			this.container.client.riffy.players.get(guild.id)?.voiceChannel;

		return isMemberDJ(member, guild, config, botVoiceChannelId);
	}
}
