import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest'
import type { RequestError } from '@octokit/types'
import { create } from 'flat-cache'
import type { ResolvedGitpaperConfiguration } from './types'

const cache = create({
	cacheId: 'gitpaper',
	ttl: 24 * 60 * 60 * 1000, // 1 day in ms
})

export async function githubUser(email: string): Promise<{ name?: string; username: string } | undefined> {
	const cached = cache.get(email)

	if (cached) {
		return cached as ReturnType<typeof githubUser>
	}

	const octokit = new Octokit({
		userAgent: 'gitpaper/0.0.0 (https://github.com/okineadev/gitpaper)',
		auth: process.env.GITHUB_TOKEN,
	})
	const { data } = await octokit.search.commits({
		q: `author-email:${email}`,
		sort: 'author-date',
		per_page: 1,
	})

	const author = data.items[0]?.author

	if (author) {
		const resolvedUser: { name?: string; username: string } = {
			name: author.name || undefined,
			username: author.login,
		}

		cache.set(email, resolvedUser)
		cache.save(true)

		return resolvedUser
	}

	return undefined
}

/**
 * Options required for sending or updating a GitHub release.
 */
interface SendReleaseOptions {
	/**
	 * The tag name for the release (e.g., 'v1.2.3').
	 */
	to: string
	/**
	 * GitHub personal access token for authentication.
	 */
	token: string
	/**
	 * The body content of the release (usually the changelog).
	 */
	changelog: string
	/**
	 * The title of the release (defaults to `to` if not provided).
	 */
	name?: string
	/**
	 * If true, the release will be created as a draft (defaults to false).
	 */
	draft?: boolean
	/**
	 * If true, the release will be marked as a prerelease (defaults to false).
	 */
	prerelease?: boolean
}

/**
 * Sends or updates a GitHub release for a given repository and tag.
 *
 * @param repo - The resolved repository configuration (owner and name).
 * @param options - Release options including tag, changelog, and metadata.
 *
 * @throws {@link RequestError} If the GitHub API request fails for reasons other than a 404 (not found).
 */
export async function sendRelease(
	repo: ResolvedGitpaperConfiguration['repo'],
	options: SendReleaseOptions,
): Promise<void> {
	// Initialize Octokit with the GitHub Token for authentication
	const octokit = new Octokit({
		auth: options.token,
	})

	const { owner, repo: repoName } = repo
	const { to: tagName, changelog, draft, name, prerelease } = options

	// Define the common payload for both creating and updating a release.
	const payload: Parameters<typeof octokit.repos.createRelease>[0] = {
		owner,
		repo: repoName,
		tag_name: tagName,
		body: changelog,
		draft: draft ?? false,
		name: name || tagName, // Use the provided name or default to the tag name
		prerelease: prerelease ?? false,
	}

	let releaseResponse:
		| RestEndpointMethodTypes['repos']['updateRelease']['response']
		| RestEndpointMethodTypes['repos']['createRelease']['response']

	try {
		// 1. Try to fetch an existing release by the tag name.
		console.log(`Checking for existing release with tag: ${tagName}...`)
		const existingRelease = await octokit.repos.getReleaseByTag({
			owner,
			repo: repoName,
			tag: tagName,
		})

		// 2. If the release exists, update its notes (body, name, draft, prerelease).
		console.log('Existing release found. Updating release notes...')
		releaseResponse = await octokit.repos.updateRelease({
			...payload,
			release_id: existingRelease.data.id,
		})
	} catch (error: unknown) {
		const knownError = error as RequestError
		// 3. If fetching the release fails (typically a 404), create a new release.
		if ((knownError as RequestError).status === 404) {
			console.log(`No existing release found. Creating new release notes for tag ${tagName}...`)
			releaseResponse = await octokit.repos.createRelease(payload)
		} else {
			// Re-throw if it's an unexpected error
			console.error('An error occurred during release operations:', error)
			throw knownError
		}
	}

	console.log(`Release successful. View it here: ${releaseResponse.data.html_url}`)
}
