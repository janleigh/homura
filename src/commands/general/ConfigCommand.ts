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
	createConfigStatusContainer,
	createConfigViewContainer,
} from "@commandUtils/general/config";
import { MUSIC_COMMANDS } from "@lib/database";
import { ApplyOptions } from "@sapphire/decorators";
import {
	type ChatInputCommand,
	Command,
	RegisterBehavior,
} from "@sapphire/framework";
import {
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";

@ApplyOptions<Command.Options>({
	name: "config",
	description: "Configure server DJ roles and command permissions",
	fullCategory: ["General"],
	requiredUserPermissions: ["ManageGuild"],
})
export class ConfigCommand extends Command {
	public override registerApplicationCommands(
		registry: ChatInputCommand.Registry,
	) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName("config")
					.setDescription(
						"Configure server DJ roles and command permissions",
					)
					.setDefaultMemberPermissions(
						PermissionFlagsBits.ManageGuild,
					)
					.setContexts(InteractionContextType.Guild)
					.addSubcommand((sub) =>
						sub
							.setName("view")
							.setDescription(
								"View the current server DJ and permission configuration",
							),
					)
					.addSubcommandGroup((group) =>
						group
							.setName("dj")
							.setDescription(
								"Manage DJ mode and DJ roles for this server",
							)
							.addSubcommand((sub) =>
								sub
									.setName("toggle")
									.setDescription("Enable or disable DJ mode")
									.addBooleanOption((opt) =>
										opt
											.setName("enabled")
											.setDescription(
												"Whether DJ mode should be enabled",
											)
											.setRequired(true),
									),
							)
							.addSubcommand((sub) =>
								sub
									.setName("add-role")
									.setDescription(
										"Add a role to the server's DJ roles",
									)
									.addRoleOption((opt) =>
										opt
											.setName("role")
											.setDescription(
												"The role to grant DJ permissions",
											)
											.setRequired(true),
									),
							)
							.addSubcommand((sub) =>
								sub
									.setName("remove-role")
									.setDescription(
										"Remove a role from the server's DJ roles",
									)
									.addRoleOption((opt) =>
										opt
											.setName("role")
											.setDescription(
												"The DJ role to remove",
											)
											.setRequired(true),
									),
							)
							.addSubcommand((sub) =>
								sub
									.setName("clear-roles")
									.setDescription(
										"Clear all configured DJ roles for this server",
									),
							),
					)
					.addSubcommandGroup((group) =>
						group
							.setName("permissions")
							.setDescription(
								"Configure which music commands require DJ access",
							)
							.addSubcommand((sub) =>
								sub
									.setName("toggle-command")
									.setDescription(
										"Toggle whether a music command is restricted to DJs",
									)
									.addStringOption((opt) =>
										opt
											.setName("command")
											.setDescription(
												"The music command to toggle",
											)
											.setRequired(true)
											.addChoices(
												MUSIC_COMMANDS.map((cmd) => ({
													name: `/${cmd}`,
													value: cmd,
												})),
											),
									),
							)
							.addSubcommand((sub) =>
								sub
									.setName("reset")
									.setDescription(
										"Reset DJ-restricted commands to the default preset",
									),
							),
					),
			{ behaviorWhenNotIdentical: RegisterBehavior.Overwrite },
		);
	}

	public async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		if (!interaction.guild) {
			return interaction.reply({
				components: [
					createConfigStatusContainer(
						"This command can only be used in a server.",
						"crossmark",
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
		}

		const { db } = this.container.client;
		const guildId = interaction.guild.id;
		const group = interaction.options.getSubcommandGroup(false);
		const subcommand = interaction.options.getSubcommand(true);

		if (!group && subcommand === "view") {
			const config = db.pruneDjRoles(guildId, (id) =>
				interaction.guild!.roles.cache.has(id),
			);
			return interaction.reply({
				components: [
					createConfigViewContainer(interaction.guild.name, config),
				],
				flags: MessageFlags.IsComponentsV2,
			});
		}

		if (group === "dj") {
			if (subcommand === "toggle") {
				const enabled = interaction.options.getBoolean("enabled", true);
				db.setDjEnabled(guildId, enabled);

				return interaction.reply({
					components: [
						createConfigStatusContainer(
							`DJ mode has been **${enabled ? "enabled" : "disabled"}** for this server.`,
							enabled ? "checkmark" : "greytick",
						),
					],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			if (subcommand === "add-role") {
				const role = interaction.options.getRole("role", true);

				if (role.id === guildId) {
					return interaction.reply({
						components: [
							createConfigStatusContainer(
								"The `@everyone` role cannot be added as a DJ role.",
								"crossmark",
							),
						],
						flags:
							MessageFlags.Ephemeral |
							MessageFlags.IsComponentsV2,
					});
				}

				const current = db.getGuildConfig(guildId);
				if (current.djRoles.includes(role.id)) {
					return interaction.reply({
						components: [
							createConfigStatusContainer(
								`<@&${role.id}> is already configured as a DJ role.`,
								"greytick",
							),
						],
						flags:
							MessageFlags.Ephemeral |
							MessageFlags.IsComponentsV2,
					});
				}

				const updated = db.addDjRole(guildId, role.id);
				const hint = !updated.djEnabled
					? "\n-# *Tip: DJ mode is currently disabled. Run `/config dj toggle enabled:True` to enforce DJ permissions.*"
					: "";

				return interaction.reply({
					components: [
						createConfigStatusContainer(
							`Added <@&${role.id}> to the server's DJ roles.${hint}`,
							"checkmark",
						),
					],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			if (subcommand === "remove-role") {
				const role = interaction.options.getRole("role", true);
				const current = db.pruneDjRoles(guildId, (id) =>
					interaction.guild!.roles.cache.has(id),
				);

				if (!current.djRoles.includes(role.id)) {
					return interaction.reply({
						components: [
							createConfigStatusContainer(
								`<@&${role.id}> is not in the server's DJ roles.`,
								"crossmark",
							),
						],
						flags:
							MessageFlags.Ephemeral |
							MessageFlags.IsComponentsV2,
					});
				}

				db.removeDjRole(guildId, role.id);

				return interaction.reply({
					components: [
						createConfigStatusContainer(
							`Removed <@&${role.id}> from the server's DJ roles.`,
							"checkmark",
						),
					],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			if (subcommand === "clear-roles") {
				db.clearDjRoles(guildId);

				return interaction.reply({
					components: [
						createConfigStatusContainer(
							"Cleared all configured DJ roles for this server.",
							"checkmark",
						),
					],
					flags: MessageFlags.IsComponentsV2,
				});
			}
		}

		if (group === "permissions") {
			if (subcommand === "toggle-command") {
				const commandName = interaction.options.getString(
					"command",
					true,
				);
				const { restricted } = db.toggleDjCommand(guildId, commandName);

				const description = restricted
					? `\`/${commandName}\` is now **restricted to DJs**${commandName === "skip" ? " (non-DJs must vote-skip)" : ""}.`
					: `\`/${commandName}\` is now **open to everyone** in the voice channel.`;

				return interaction.reply({
					components: [
						createConfigStatusContainer(
							description,
							restricted ? "checkmark" : "greytick",
						),
					],
					flags: MessageFlags.IsComponentsV2,
				});
			}

			if (subcommand === "reset") {
				db.resetDjCommands(guildId);

				return interaction.reply({
					components: [
						createConfigStatusContainer(
							"Reset DJ-restricted commands to the default Jockie-style preset.",
							"checkmark",
						),
					],
					flags: MessageFlags.IsComponentsV2,
				});
			}
		}
	}
}
