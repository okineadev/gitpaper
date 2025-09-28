import fs from 'node:fs/promises'
import path from 'node:path'
import Handlebars from 'handlebars'
import { upperFirst } from 'scule'
import { githubUser } from './github'
import type {
	GitCommit,
	GitCommitAuthor,
	ResolvedGitCommitAuthor,
	ResolvedGitpaperConfiguration,
	Section,
} from './types'

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

	const sections: Section[] = (
		await Promise.all(
			Object.entries(config.types)
				.filter((type): type is [string, string] => type[1] !== false)
				.map(async ([type, title]) => {
					const commits_ = await Promise.all(
						commits
							.filter((e) => e.type === type)
							.map(async (commit) => {
								if (config.resolveContributorsGitHub) {
									const resolvedAuthorGithub = await githubUser(commit.author.email)
									if (resolvedAuthorGithub) {
										return {
											...commit,
											author: {
												...commit.author,
												name: resolvedAuthorGithub.name || commit.author.name,
												username: resolvedAuthorGithub.username,
											} as ResolvedGitCommitAuthor,
										}
									}
								}
								return commit
							}),
					)

					if (!commits_.length) return null
					return { title: config.emoji ? title : title.slice(3), commits: commits_ }
				}),
		)
	).filter(Boolean) as Section[]

	const allCommits: GitCommit[] = sections.flatMap((section) => section.commits)

	const contributors: (GitCommitAuthor | ResolvedGitCommitAuthor)[] | undefined = config.contributors
		? Array.from(
				new Map(
					allCommits
						.flatMap((e) => [...e.coAuthors, e.author])
						.filter((a) => {
							if (config.excludeBots && /\[bot\]$/i.test(a.name.trim())) return false
							if (typeof config.excludeContributors === 'function') return !config.excludeContributors(a)
							if (Array.isArray(config.excludeContributors)) {
								if (config.excludeContributors.includes(a.name)) return false
								if (config.excludeContributors.includes(a.email)) return false
							}
							return true
						})
						.map((a) => [a.email, a]),
				).values(),
			)
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
