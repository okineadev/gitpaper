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

	// Allowed authors
	const allAuthors = commits
		.flatMap((commit) => commit.author)
		.filter(
			(author, index, array) =>
				index === array.findIndex((a) => a.name.trim().toLowerCase() === author.name.trim().toLowerCase()),
		)
		.filter((author) => {
			if (config.excludeBots && /\[bot\]$/i.test(author.name.trim())) return false
			if (typeof config.excludeContributors === 'function') return !config.excludeContributors(author)
			if (Array.isArray(config.excludeContributors)) {
				if (config.excludeContributors.includes(author.name)) return false
				if (config.excludeContributors.includes(author.email)) return false
			}
			return true
		})

	const filteredCommits = commits.filter((commit) =>
		allAuthors.some((author) => author.name === commit.author.name && author.email === commit.author.email),
	)

	const sections: Section[] = (
		await Promise.all(
			Object.entries(config.types)
				.filter((type): type is [string, string] => type[1] !== false)
				.map(async ([type, title]) => {
					const commits_ = await Promise.all(
						filteredCommits
							.filter((e) => e.type === type)
							.map((commit) => ({
								...commit,
								coAuthors: commit.coAuthors.filter(
									(coAuthor) =>
										coAuthor.email !== commit.author.email && coAuthor.name !== commit.author.name,
									// !Object.keys(commit.author).every(
									// 	(key) =>
									// 		Object.hasOwn(commit.author, key) &&
									// 		coAuthor[key as keyof GitCommitAuthor] ===
									// 			commit.author[key as keyof GitCommitAuthor],
									// ),
								),
							}))
							.map(async (commit) => {
								let author = commit.author
								let coAuthors = commit.coAuthors

								const [resolvedAuthorGithub, resolvedCoAuthors] = await Promise.all([
									config.resolveContributorsGitHub ? githubUser(commit.author.email) : Promise.resolve(null),
									config.contributors && commit.coAuthors?.length
										? Promise.all(
												commit.coAuthors.map(async (co) => {
													const resolved = await githubUser(co.email)
													return resolved
														? ({
																...co,
																name: resolved.name || co.name,
																username: resolved.username,
															} as ResolvedGitCommitAuthor)
														: co
												}),
											)
										: Promise.resolve(commit.coAuthors),
								])

								if (resolvedAuthorGithub) {
									author = {
										...commit.author,
										name: resolvedAuthorGithub.name || commit.author.name,
										username: resolvedAuthorGithub.username,
									} as ResolvedGitCommitAuthor
								}

								coAuthors = resolvedCoAuthors

								return {
									...commit,
									author,
									coAuthors,
								}
							}),
					)

					if (!commits_.length) return null
					return {
						title: config.emoji ? title : title.slice(3),
						commits: commits_,
					}
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
