import type { GitCommit, GitCommitAuthor, ResolvedGitpaperConfiguration } from '../types'

function isExcludedAuthor(author: GitCommitAuthor, config: ResolvedGitpaperConfiguration): boolean {
	const { excludeContributors } = config

	return (
		(config.excludeBots && /\[bot\]$/iu.test(author.name)) ||
		(typeof excludeContributors === 'function' && excludeContributors(author)) ||
		(Array.isArray(excludeContributors) &&
			(excludeContributors.includes(author.name) || excludeContributors.includes(author.email)))
	)
}

/**
 * Walks the given commits and builds a map of unique authors, keyed by
 * `name|email`. Skips bot authors (if `config.excludeBots` is set) and any
 * author matched by `config.excludeContributors` (function or array form).
 *
 * @param commits - Commits whose authors should be collected.
 * @param config - Configuration controlling which authors are excluded.
 * @returns A map of unique authors keyed by their name and email.
 */
export function collectUniqueAuthors(
	commits: GitCommit[],
	config: ResolvedGitpaperConfiguration,
): Map<string, GitCommitAuthor> {
	return new Map(
		commits
			.map(({ author }) => author)
			.filter((author) => !isExcludedAuthor(author, config))
			.map((author) => [`${author.name}|${author.email}`, author]),
	)
}

/**
 * Filters commits down to only those whose author is present in
 * `allowedAuthors` (as produced by {@link collectUniqueAuthors}).
 *
 * @param commits - Commits to filter.
 * @param allowedAuthors - Authors whose commits should be retained.
 * @returns The commits authored by an allowed author.
 */
export function filterCommitsByAllowedAuthors(
	commits: GitCommit[],
	allowedAuthors: Map<string, GitCommitAuthor>,
): GitCommit[] {
	const allowedAuthorKeys = new Set(allowedAuthors.keys())

	return commits.filter((commit) => allowedAuthorKeys.has(`${commit.author.name}|${commit.author.email}`))
}
