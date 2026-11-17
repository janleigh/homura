import { createMusicStatusContainer } from "@commandUtils/music/status";
import { ApplyOptions } from "@sapphire/decorators";
import {
	type ChatInputCommandDeniedPayload,
	Events,
	Identifiers,
	Listener,
	type UserError,
} from "@sapphire/framework";
import { parsers } from "@utils/index";
import { MessageFlags } from "discord.js";

@ApplyOptions<Listener.Options>({
	event: Events.ChatInputCommandDenied,
})
export class ChatInputCommandDeniedListener extends Listener<
	typeof Events.ChatInputCommandDenied
> {
	public async run(
		error: UserError,
		{ interaction }: ChatInputCommandDeniedPayload,
	) {
		const message =
			error.identifier === Identifiers.PreconditionUserPermissions
				? `You lack the required permissions to run this command: ${((error.context as { missing: string[] })?.missing ?? []).map((perm) => `\`${perm}\``).join(", ")}`
				: error.message;

		const crossmark = parsers.getEmoji("crossmark")?.toString() ?? "❌";
		const components = [createMusicStatusContainer(message, crossmark)];

		return interaction.deferred || interaction.replied
			? interaction.editReply({
					components,
					flags: MessageFlags.IsComponentsV2,
				})
			: interaction.reply({
					components,
					flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
				});
	}
}
