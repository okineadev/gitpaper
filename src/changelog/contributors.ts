import type {
	GitCommit,
	GitCommitAuthor,
	ResolvedGitCommitAuthor,
	ResolvedGitpaperConfiguration,
	Section,
} from '../types'

import { githubUser } from '../github'

/**
 * Resolves a single commit's author and co-authors against GitHub (when
 * enabled in config), replacing display names with the GitHub profile name
 * and attaching a `username` where a match is found. Co-authors that are
 * actually the same person as the primary author (matching email or name)
 * are filtered out first.
 *
 * @param commit - Commit whose authors should be resolved.
 * @param config - Configuration controlling GitHub lookups.
 * @returns The commit with resolved author and co-author information.
 */
export async function resolveCommitAuthor(
	commit: GitCommit,
	config: ResolvedGitpaperConfiguration,
): Promise<GitCommit> {
	const dedupedCoAuthors = commit.coAuthors.filter(
		(coAuthor) => coAuthor.email !== commit.author.email && coAuthor.name !== commit.author.name,
	)

	let { author } = commit

	// oxlint-disable-next-line one-var
	const [resolvedAuthorGithub, resolvedCoAuthors] = await Promise.all([
		config.resolveContributorsGitHub ? githubUser(commit.author.email) : Promise.resolve(),
		config.contributors && dedupedCoAuthors.length > 0
			? Promise.all(
					dedupedCoAuthors.map(async (co) => {
						const resolved = await githubUser(co.email)
						return resolved
							? {
									...co,
									name: resolved.name ?? co.name,
									username: resolved.username,
								}
							: co
					}),
				)
			: Promise.resolve(dedupedCoAuthors),
	])

	if (resolvedAuthorGithub) {
		author = {
			...commit.author,
			name: resolvedAuthorGithub.name ?? commit.author.name,
			username: resolvedAuthorGithub.username,
		}
	}

	return {
		...commit,
		author,
		coAuthors: resolvedCoAuthors,
	}
}

/**
 * Builds the deduplicated (by email) list of contributors across every
 * commit and co-author in the given sections, or `undefined` if
 * `config.contributors` is disabled.
 *
 * @param sections - Changelog sections whose contributors should be collected.
 * @param config - Configuration controlling whether contributors are included.
 * @returns The deduplicated contributors, or `undefined` when disabled.
 */
export function buildContributorList(
	sections: Section[],
	config: ResolvedGitpaperConfiguration,
): (GitCommitAuthor | ResolvedGitCommitAuthor)[] | undefined {
	if (!config.contributors) {
		return undefined
	}

	const allCommits = sections.flatMap((section) => section.commits)

	return [
		...new Map(
			allCommits
				.flatMap((entry) => {
					const authors = entry.coAuthors.map((coAuthor) => coAuthor)
					authors.push(entry.author)
					return authors
				})
				.map((author) => [author.email, author] as const),
		).values(),
	]
}
