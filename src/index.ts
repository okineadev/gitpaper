import Handlebars from 'handlebars'
import { upperFirst } from 'scule'
import changelogTemplate from './changelog-template.hbs' with { type: 'text' }
import type { GitCommit } from './git'

/**
 * A mapping of change types to their corresponding section titles in the changelog.
 * Each key represents a type of change (e.g., 'feat', 'fix'), and the value is the
 * title that will appear in the changelog for that type.
 */
const changeTypes = {
	feat: '🚀 Enhancements',
	perf: '🔥 Performance',
	fix: '🩹 Fixes',
	refactor: '💅 Refactors',
	docs: '📖 Documentation',
	build: '📦 Build',
	types: '🌊 Types',
	chore: '🏡 Chores',
	examples: '🏀 Examples',
	test: '✅ Tests',
	style: '🎨 Styles',
	ci: '🤖 CI',
} as const

type ChangeTypes = typeof changeTypes

export interface ChangelogEntry {
	/**
	 * The type of changes corresponding to Conventional Commits format
	 *
	 * @example 'feat'
	 * @example 'fix'
	 */
	type: keyof ChangeTypes

	/**
	 * The title or summary of the change
	 *
	 * @example 'Add new authentication feature'
	 */
	text: string

	/**
	 * Detailed description of the changes made
	 *
	 * @example 'Implemented OAuth2 authentication flow with Google provider'
	 */
	description?: string

	/**
	 * The name or username of the person who made the change
	 *
	 * @example 'octocat'
	 */
	author: string
}

/**
 * Generates a formatted changelog from an array of changelog entries.
 * The changelog is organized by change types (feat, fix, etc.) and includes
 * entry details such as text, description, and author
 *
 * @param entries - An array of changelog entries to process
 * @returns A formatted string containing the complete changelog
 *
 * @example
 * const changelog = generateChangelog([
 *   {
 *     type: 'feat',
 *     text: 'Add user authentication',
 *     description: 'Implemented JWT-based auth',
 *     author: 'john.doe',
 *   },
 * ])
 *
 * console.log(changelog)
 * // Output:
 * // ### 🚀 Enhancements
 * //
 * // - Add user authentication by \@john.doe
 * //   > Implemented JWT-based auth
 * //
 * // ### ❤️ Contributors
 * //
 * // - \@john.doe
 */

const template = Handlebars.compile(changelogTemplate)

// Register shaShort helper
Handlebars.registerHelper('shaShort', (sha: string) => sha.slice(0, 5))
Handlebars.registerHelper('splitLines', (text: string) => text.split(/\r?\n/))

interface Section {
	title: string
	emoji: string
	commits: Array<{
		description: string
		author: string
		sha: string
		scope: string
		changelogBody?: string
	}>
}

export function generateChangelog(
	entries: GitCommit[],
	options: {
		owner: string
		repo: string
	} = { owner: '', repo: '' },
): string {
	const sections: Section[] = Object.entries(changeTypes)
		.map(([type, title]) => {
			const emoji = title.split(' ')[0]
			const commits = entries
				.filter((e) => e.type === type)
				.map((e) => ({
					description: upperFirst(e.description),
					author: e.author.name,
					sha: e.hash,
					scope: e.scope,
					changelogBody: e.changelogBody,
				}))
			if (!commits.length) return null
			return { title: title.slice(2), emoji, commits }
		})
		.filter(Boolean) as Section[]

	const contributors = Array.from(new Set(entries.flatMap((e) => e.authors.map((a) => a.name) ?? [])))

	return template({
		sections,
		owner: options.owner,
		repo: options.repo,
		scope: options,
		contributors,
	})
}

// export function
