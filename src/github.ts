import { Octokit } from '@octokit/rest'
import { create } from 'flat-cache'

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
