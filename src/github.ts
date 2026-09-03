import { RequestError } from '@octokit/request-error'
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest'
import { create } from 'flat-cache'

import type { ResolvedGitpaperConfiguration, GitHubUser } from './types'

import { version as VERSION } from '../package.json'

const cache = create({
		cacheId: 'gitpaper',
		// oxlint-disable-next-line no-magic-numbers
		ttl: 24 * 60 * 60 * 1000, // 1 day in ms
	}),
	NOT_FOUND_STATUS = 404

export async function githubUser(email: string): Promise<GitHubUser | undefined> {
	const cached: GitHubUser | undefined = cache.get(email)

	if (cached !== undefined) {
		return cached
	}

	// oxlint-disable-next-line one-var
	const octokit = new Octokit({
			auth: process.env['GITHUB_TOKEN'],
			userAgent: `gitpaper/${VERSION} (https://github.com/okineadev/gitpaper)`,
		}),
		{ data } = await octokit.search.commits({
			per_page: 1,
			// oxlint-disable-next-line id-length
			q: `author-email:${email}`,
			sort: 'author-date',
		}),
		author = data.items[0]?.author

	if (author) {
		const resolvedUser: GitHubUser = {
			name: author.name ?? undefined,
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

type ReleaseResponse =
	| RestEndpointMethodTypes['repos']['updateRelease']['response']
	| RestEndpointMethodTypes['repos']['createRelease']['response']

type CreateReleaseParameters = RestEndpointMethodTypes['repos']['createRelease']['parameters']

function buildReleasePayload(
	options: SendReleaseOptions,
	owner: string,
	repoName: string,
): CreateReleaseParameters {
	const { to: tagName, changelog, draft, name, prerelease } = options

	return {
		body: changelog,
		draft: draft ?? false,
		name: name ?? tagName,
		owner,
		prerelease: prerelease ?? false,
		repo: repoName,
		tag_name: tagName,
	}
}

/**
 * Updates an existing release if one exists for the tag; otherwise creates a
 * new release.
 *
 * @param octokit - The authenticated Octokit client.
 * @param payload - The release payload.
 * @returns The GitHub API response for the created or updated release.
 */
async function upsertRelease(octokit: Octokit, payload: CreateReleaseParameters): Promise<ReleaseResponse> {
	const { owner, repo: repoName, tag_name: tagName } = payload

	try {
		const existingRelease = await octokit.repos.getReleaseByTag({
			owner,
			repo: repoName,
			tag: tagName,
		})

		console.log('Existing release found. Updating release notes...')
		return await octokit.repos.updateRelease({
			...payload,
			release_id: existingRelease.data.id,
		})
	} catch (error: unknown) {
		if (error instanceof RequestError && error.status === NOT_FOUND_STATUS) {
			console.log(`No existing release found. Creating new release notes for tag ${tagName}...`)
			return octokit.repos.createRelease(payload)
		}

		throw error
	}
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
	const octokit = new Octokit({
			auth: options.token,
		}),
		{ owner, repo: repoName } = repo,
		payload = buildReleasePayload(options, owner, repoName),
		releaseResponse = await upsertRelease(octokit, payload)

	console.log(`Checking for existing release with tag: ${payload.tag_name}...`)
	console.log(`Release successful. View it here: ${releaseResponse.data.html_url}`)
}
