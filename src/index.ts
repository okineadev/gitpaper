import fs from 'node:fs/promises'
import path from 'node:path'
import Handlebars from 'handlebars'
import { upperFirst } from 'scule'
import type { GitCommit, ResolvedGitpaperConfiguration, Section } from './types'

/**
 * Generates a formatted changelog from an array of changelog entries.
 * The changelog is organized by change types (feat, fix, etc.) and includes
 * entry details such as text, description, and author
 *
 * @param commits - An array of changelog entries to process
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
	commits: GitCommit[],
	config: ResolvedGitpaperConfiguration,
	prevTag?: string,
	newTag?: string,
): Promise<string> {
	Handlebars.registerPartial(
		'commit',
		await fs.readFile(path.resolve(__dirname, './template/partials/commit.hbs'), { encoding: 'utf-8' }),
	)
	Handlebars.registerPartial(
		'contributors',
		await fs.readFile(path.resolve(__dirname, './template/partials/contributors.hbs'), { encoding: 'utf-8' }),
	)
	Handlebars.registerPartial(
		'section',
		await fs.readFile(path.resolve(__dirname, './template/partials/section.hbs'), { encoding: 'utf-8' }),
	)

	const template = Handlebars.compile(
		await fs.readFile(path.resolve(__dirname, './template/changelog.hbs'), { encoding: 'utf-8' }),
	)

	// Register shaShort helper
	Handlebars.registerHelper('shaShort', (sha: string) => sha.slice(0, 5))
	Handlebars.registerHelper('splitLines', (text: string) => text.split(/\r?\n/))
	Handlebars.registerHelper('upperFirst', upperFirst)

	const sections: Section[] = Object.entries(config.types)
		.filter((type): type is [string, string] => type[1] !== false)
		.map(([type, title]) => {
			const commits_ = commits.filter((e) => e.type === type)

			if (!commits_.length) return null
			return { title: config.emoji ? title : title.slice(3), commits: commits_ }
		})
		.filter(Boolean) as Section[]

	const contributors: string[] | undefined = config.contributors
		? Array.from(new Set(commits.flatMap((e) => [...e.coAuthors, e.author].map((a) => a.name) ?? [])))
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
