import Handlebars from 'handlebars'
import { upperFirst } from 'scule'
import changelogTemplate from './template/changelog.hbs' with { type: 'text' }
import type { GitCommit, ResolvedGitpaperConfiguration, Section } from './types'

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
export async function generateChangelog(
	entries: GitCommit[],
	config: ResolvedGitpaperConfiguration,
	prevTag?: string,
	newTag?: string,
): Promise<string> {
	await Promise.all([
		Handlebars.registerPartial(
			'commit',
			(await import('./template/partials/commit.hbs', { with: { type: 'text' } })).default,
		),
		Handlebars.registerPartial(
			'contributors',
			(await import('./template/partials/contributors.hbs', { with: { type: 'text' } })).default,
		),
		Handlebars.registerPartial(
			'section',
			(await import('./template/partials/section.hbs', { with: { type: 'text' } })).default,
		),
	])

	const template = Handlebars.compile(changelogTemplate)

	// Register shaShort helper
	Handlebars.registerHelper('shaShort', (sha: string) => sha.slice(0, 5))
	Handlebars.registerHelper('splitLines', (text: string) => text.split(/\r?\n/))
	Handlebars.registerHelper('upperFirst', upperFirst)

	const sections: Section[] = Object.entries(config.types)
		.filter((type): type is [string, string] => type[1] !== false)
		.map(([type, title]) => {
			const commits = entries.filter((e) => e.type === type)

			if (!commits.length) return null
			return { title: config.emoji ? title : title.slice(3), commits }
		})
		.filter(Boolean) as Section[]

	const contributors: string[] | undefined = config.contributors
		? Array.from(new Set(entries.flatMap((e) => e.authors.map((a) => a.name) ?? [])))
		: undefined

	return template({
		sections,
		owner: config.repo.owner,
		repo: config.repo.repo,
		prevTag,
		newTag,
		contributors,
	}).trim()
}
