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
	// Register Handlebars partials
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

	// Register helpers
	Handlebars.registerHelper('shaShort', (sha: string) => sha.slice(0, 5))
	Handlebars.registerHelper('splitLines', (text: string) => text.split(/\r?\n/))
	Handlebars.registerHelper('upperFirst', upperFirst)

	// --- 1. Normalize commits ---
	const normalizedCommits = commits.filter((c) => c.author && c.type)

	// --- 2. Collect unique authors ---
	const uniqueAuthors = new Map<string, GitCommitAuthor>()

	for (const commit of normalizedCommits) {
		const { author } = commit
		if (config.excludeBots && /\[bot\]$/i.test(author.name)) continue

		const key = `${author.name}|${author.email}`
		if (uniqueAuthors.has(key)) continue

		if (typeof config.excludeContributors === 'function' && config.excludeContributors(author)) continue
		if (Array.isArray(config.excludeContributors)) {
			if (
				config.excludeContributors.includes(author.name) ||
				config.excludeContributors.includes(author.email)
			)
				continue
		}

		uniqueAuthors.set(key, author)
	}

	// --- 3. Filter commits by allowed authors ---
	const allowedAuthorKeys = new Set(uniqueAuthors.keys())

	const filteredCommits = normalizedCommits.filter((c) =>
		allowedAuthorKeys.has(`${c.author.name}|${c.author.email}`),
	)

	// --- 4. Group commits by type ---
	const commitsByType = new Map<string, GitCommit[]>()

	for (const commit of filteredCommits) {
		const arr = commitsByType.get(commit.type) ?? []
		arr.push(commit)
		commitsByType.set(commit.type, arr)
	}

	// --- 5. Generate sections from grouped commits ---
	const sections: Section[] = (
		await Promise.all(
			Object.entries(config.types)
				.filter((type): type is [string, string] => type[1] !== false)
				.map(async ([type, title]) => {
					const commits_ = commitsByType.get(type)
					if (!commits_?.length) return null

					const resolvedCommits = await Promise.all(
						commits_
							.map((commit) => ({
								...commit,
								coAuthors: commit.coAuthors.filter(
									(coAuthor) =>
										coAuthor.email !== commit.author.email && coAuthor.name !== commit.author.name,
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

					if (!resolvedCommits.length) return null
					return {
						title: config.emoji ? title : title.slice(3),
						commits: resolvedCommits,
					}
				}),
		)
	).filter(Boolean) as Section[]

	// Collect all commits from every section into a single array
	const allCommits: GitCommit[] = sections.flatMap((section) => section.commits)

	// Build the list of unique contributors, if enabled in config
	const contributors: (GitCommitAuthor | ResolvedGitCommitAuthor)[] | undefined = config.contributors
		? Array.from(
				new Map(
					allCommits
						// Flatten all authors and co-authors from every commit
						.flatMap((e) => [...e.coAuthors, e.author])
						// Use email as a unique key to remove duplicates
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
