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
	ContainerBuilder,
	SeparatorBuilder,
	TextDisplayBuilder,
} from "@discordjs/builders";
import { type GuildConfig, MUSIC_COMMANDS } from "@lib/database";
import type { EmojiName } from "@lib/types/constants/Emoji";
import { parsers } from "@utils/index";

export function createConfigStatusContainer(
	description: string,
	emoji: EmojiName = "greytick",
): ContainerBuilder {
	const resolvedEmoji = parsers.getEmoji(emoji)?.toString() ?? "⚙️";
	return new ContainerBuilder().addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`${resolvedEmoji}  ${description}`),
	);
}

export function createConfigViewContainer(
	guildName: string,
	config: GuildConfig,
): ContainerBuilder {
	const checkmark = parsers.getEmoji("checkmark")?.toString() ?? "🟢";
	const greytick = parsers.getEmoji("greytick")?.toString() ?? "⚪";
	const djStatus = config.djEnabled
		? `${checkmark} Enabled`
		: `${greytick} Disabled`;
	const djRolesText =
		config.djRoles.length > 0
			? config.djRoles.map((id) => `<@&${id}>`).join(", ")
			: "*None configured*";

	const restrictedCommands = MUSIC_COMMANDS.filter((cmd) =>
		config.djCommands.includes(cmd),
	);
	const openCommands = MUSIC_COMMANDS.filter(
		(cmd) => !config.djCommands.includes(cmd),
	);

	const restrictedText =
		restrictedCommands.length > 0
			? restrictedCommands.map((cmd) => `\`/${cmd}\``).join(", ")
			: "*None*";
	const openText =
		openCommands.length > 0
			? openCommands.map((cmd) => `\`/${cmd}\``).join(", ")
			: "*None*";

	return new ContainerBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`## ⚙️  Server Configuration — ${guildName}`,
			),
		)
		.addSeparatorComponents(new SeparatorBuilder())
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`**DJ Mode:** ${djStatus}\n` +
					`**DJ Roles (${config.djRoles.length}):** ${djRolesText}\n\n` +
					`**DJ-Restricted Commands (${restrictedCommands.length}):**\n${restrictedText}\n\n` +
					`**Open Commands (${openCommands.length}):**\n${openText}`,
			),
		)
		.addSeparatorComponents(new SeparatorBuilder())
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"-# *When DJ Mode is enabled, members with **Manage Server**, a **DJ Role**, or who are **alone in the voice channel** have DJ access. Non-DJs can still vote-skip with `/skip` and remove tracks they requested.*",
			),
		);
}
