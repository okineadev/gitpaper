// oxlint-disable import/prefer-default-export
import type { GitCommit, ResolvedGitpaperConfiguration } from './types'

import { collectUniqueAuthors, filterCommitsByAllowedAuthors } from './changelog/authors'
import { buildContributorList } from './changelog/contributors'
import { loadTemplate, registerHelpers, registerPartials } from './changelog/partials'
import { buildSections, groupCommitsByType } from './changelog/sections'

/**
 * Generates a formatted changelog from an array of changelog entries.
 * The changelog is organized by change types (feat, fix, etc.) and includes
 * entry details such as text, description, and author
 *
 * @param commits - An array of changelog entries to process
 * @param config - The resolved Gitpaper configuration
 * @param prevTag - The previous release tag
 * @param newTag - The new release tag
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
// eslint-disable-next-line max-params
export async function generateChangelog(
	commits: GitCommit[],
	config: ResolvedGitpaperConfiguration,
	prevTag?: string,
	newTag?: string,
): Promise<string> {
	await registerPartials()
	registerHelpers()
	const template = await loadTemplate(),
		uniqueAuthors = collectUniqueAuthors(commits, config),
		filteredCommits = filterCommitsByAllowedAuthors(commits, uniqueAuthors),
		commitsByType = groupCommitsByType(filteredCommits),
		sections = await buildSections(commitsByType, config),
		contributors = buildContributorList(sections, config)

	return template({
		contributors,
		newTag,
		owner: config.repo.owner,
		prevTag,
		repo: config.repo.repo,
		sections,
	}).trim()
}
