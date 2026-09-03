import type { GitCommit, ResolvedGitpaperConfiguration, Section } from '../types'

import { resolveCommitAuthor } from './contributors'

/**
 * Groups commits into a map keyed by commit `type` (e.g. 'feat', 'fix').
 *
 * @param commits - The commits to group by their type.
 * @returns A map of commit type to the list of commits of that type.
 */
export function groupCommitsByType(commits: GitCommit[]): Map<string, GitCommit[]> {
	const commitsByType = new Map<string, GitCommit[]>()

	for (const commit of commits) {
		const arr = commitsByType.get(commit.type) ?? []
		arr.push(commit)
		commitsByType.set(commit.type, arr)
	}

	return commitsByType
}

function isValidSection(value: Section | null): value is Section {
	return value !== null
}

/**
 * Builds the ordered list of changelog {@link Section}s from commits grouped
 * by type. Iterates `config.types` (rather than the map) so section order
 * follows the configured type order; types set to `false` are skipped, as
 * are types with no matching commits. Each commit's author/co-authors are
 * resolved against GitHub via {@link resolveCommitAuthor}.
 *
 * @param commitsByType - The commits grouped by commit type.
 * @param config - The resolved Gitpaper configuration.
 * @returns The ordered list of resolved changelog sections.
 */
export async function buildSections(
	commitsByType: Map<string, GitCommit[]>,
	config: ResolvedGitpaperConfiguration,
): Promise<Section[]> {
	const resolvedSections = await Promise.all(
			Object.entries(config.types)
				.filter((type): type is [string, string] => type[1] !== false)
				.map(async ([type, title]) => {
					/* oxlint-disable unicorn/no-null - We will filter out empty sections by skipping `null` values later. */
					const commits = commitsByType.get(type)
					if (commits === undefined || commits.length === 0) {
						return null
					}

					// oxlint-disable-next-line one-var
					const resolvedCommits = await Promise.all(
						commits.map(async (commit) => resolveCommitAuthor(commit, config)),
					)

					if (resolvedCommits.length === 0) {
						return null
					}
					/* oxlint-enable unicorn/no-null */

					// oxlint-disable-next-line one-var
					const EMOJI_AND_SPACE_BEFORE_TITLE = 3

					return {
						commits: resolvedCommits,
						title: config.emoji ? title : title.slice(EMOJI_AND_SPACE_BEFORE_TITLE),
					}
				}),
		),
		sections: Section[] = resolvedSections.filter(isValidSection)

	return sections.filter(Boolean)
}
