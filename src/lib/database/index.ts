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

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const MUSIC_COMMANDS = [
	"destroy",
	"loop",
	"move",
	"nowplaying",
	"pause",
	"playback",
	"play",
	"playnext",
	"queue",
	"remove",
	"resume",
	"shuffle",
	"skip",
	"volume",
] as const;

export type MusicCommandName = (typeof MUSIC_COMMANDS)[number];

export const DEFAULT_DJ_COMMANDS: MusicCommandName[] = [
	"destroy",
	"loop",
	"move",
	"pause",
	"playback",
	"playnext",
	"remove",
	"resume",
	"shuffle",
	"skip",
	"volume",
];

export interface GuildConfig {
	guildId: string;
	djEnabled: boolean;
	djRoles: string[];
	djCommands: string[];
}

interface GuildConfigRow {
	guild_id: string;
	dj_enabled: number;
	dj_roles: string;
	dj_commands: string;
}

const DEFAULT_DJ_COMMANDS_JSON = JSON.stringify(DEFAULT_DJ_COMMANDS);

export class DatabaseManager {
	private readonly db: Database;

	public constructor(dbPath: string = "data/homura.db") {
		if (dbPath !== ":memory:") {
			mkdirSync(dirname(dbPath), { recursive: true });
		}

		this.db = new Database(dbPath, { create: true });
		this.db.run("PRAGMA journal_mode = WAL;");
		this.db.run(`
			CREATE TABLE IF NOT EXISTS guild_configs (
				guild_id TEXT PRIMARY KEY,
				dj_enabled INTEGER NOT NULL DEFAULT 0,
				dj_roles TEXT NOT NULL DEFAULT '[]',
				dj_commands TEXT NOT NULL DEFAULT '${DEFAULT_DJ_COMMANDS_JSON}'
			)
		`);
	}

	public getGuildConfig(guildId: string): GuildConfig {
		const row = this.db
			.query<GuildConfigRow, [string]>(
				"SELECT guild_id, dj_enabled, dj_roles, dj_commands FROM guild_configs WHERE guild_id = ?",
			)
			.get(guildId);

		if (!row) {
			return {
				guildId,
				djEnabled: false,
				djRoles: [],
				djCommands: [...DEFAULT_DJ_COMMANDS],
			};
		}

		return {
			guildId: row.guild_id,
			djEnabled: Boolean(row.dj_enabled),
			djRoles: this.parseStringArray(row.dj_roles, []),
			djCommands: this.parseStringArray(
				row.dj_commands,
				DEFAULT_DJ_COMMANDS,
			),
		};
	}

	public setDjEnabled(guildId: string, enabled: boolean): GuildConfig {
		const current = this.getGuildConfig(guildId);
		current.djEnabled = enabled;
		return this.saveGuildConfig(current);
	}

	public addDjRole(guildId: string, roleId: string): GuildConfig {
		const current = this.getGuildConfig(guildId);
		if (!current.djRoles.includes(roleId)) {
			current.djRoles.push(roleId);
			return this.saveGuildConfig(current);
		}
		return current;
	}

	public removeDjRole(guildId: string, roleId: string): GuildConfig {
		const current = this.getGuildConfig(guildId);
		const filtered = current.djRoles.filter((id) => id !== roleId);
		if (filtered.length !== current.djRoles.length) {
			current.djRoles = filtered;
			return this.saveGuildConfig(current);
		}
		return current;
	}

	public clearDjRoles(guildId: string): GuildConfig {
		const current = this.getGuildConfig(guildId);
		current.djRoles = [];
		return this.saveGuildConfig(current);
	}

	public pruneDjRoles(
		guildId: string,
		hasRole: (roleId: string) => boolean,
	): GuildConfig {
		const current = this.getGuildConfig(guildId);
		const valid = current.djRoles.filter(hasRole);
		if (valid.length !== current.djRoles.length) {
			current.djRoles = valid;
			return this.saveGuildConfig(current);
		}
		return current;
	}

	public toggleDjCommand(
		guildId: string,
		commandName: string,
	): { config: GuildConfig; restricted: boolean } {
		const current = this.getGuildConfig(guildId);
		const index = current.djCommands.indexOf(commandName);
		let restricted: boolean;

		if (index >= 0) {
			current.djCommands.splice(index, 1);
			restricted = false;
		} else {
			current.djCommands.push(commandName);
			restricted = true;
		}

		return {
			config: this.saveGuildConfig(current),
			restricted,
		};
	}

	public resetDjCommands(guildId: string): GuildConfig {
		const current = this.getGuildConfig(guildId);
		current.djCommands = [...DEFAULT_DJ_COMMANDS];
		return this.saveGuildConfig(current);
	}

	public close(): void {
		this.db.close();
	}

	private saveGuildConfig(config: GuildConfig): GuildConfig {
		this.db
			.query(
				`INSERT INTO guild_configs (guild_id, dj_enabled, dj_roles, dj_commands)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(guild_id) DO UPDATE SET
					dj_enabled = excluded.dj_enabled,
					dj_roles = excluded.dj_roles,
					dj_commands = excluded.dj_commands`,
			)
			.run(
				config.guildId,
				config.djEnabled ? 1 : 0,
				JSON.stringify(config.djRoles),
				JSON.stringify(config.djCommands),
			);

		return config;
	}

	private parseStringArray(raw: string, fallback: string[]): string[] {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (
				Array.isArray(parsed) &&
				parsed.every((item) => typeof item === "string")
			) {
				return parsed;
			}
		} catch {
			// Fall back to default array on malformed JSON
		}
		return [...fallback];
	}
}
