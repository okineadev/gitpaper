import type {
	GitCommit,
	GitCommitAuthor,
	RawGitCommit,
	ResolvedGitpaperConfiguration,
	NotYetResolvedGitpaperConfiguration,
} from '../src/types'

import { defaultConfig } from '../src/config'

export const author = (name = 'Alice', email = 'alice@example.com'): GitCommitAuthor => ({ email, name })

export const rawCommit = (message: string, body = ''): RawGitCommit => ({
	author: author(),
	body,
	coAuthors: [],
	date: '1970-01-01T00:00:00Z',
	hash: 'abcdef1234567890',
	message,
})

export const commit = (overrides: Partial<GitCommit> = {}): GitCommit => ({
	...rawCommit('feat: add feature'),
	isBreaking: false,
	scope: '',
	subject: 'add feature',
	type: 'feat',
	...overrides,
})

export const config = (
	overrides: Partial<ResolvedGitpaperConfiguration> = {},
): ResolvedGitpaperConfiguration => ({
	...(defaultConfig as NotYetResolvedGitpaperConfiguration),
	repo: { owner: 'okineadev', repo: 'gitpaper' },
	...overrides,
})
