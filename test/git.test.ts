import { describe, expect, test } from 'bun:test'

import { parseCommits, parseGitCommit } from '../src/git'
import { rawCommit } from './fixtures'

describe('parseGitCommit', () => {
	test('parses type, scope, subject, and breaking marker', async () => {
		const parsed = await parseGitCommit(rawCommit('feat(parser)!: support emojis'))

		expect(parsed).toMatchObject({
			isBreaking: true,
			scope: 'parser',
			subject: 'support emojis',
			type: 'feat',
		})
	})

	test('supports an emoji before the type and in the subject', async () => {
		const parsed = await parseGitCommit(rawCommit('🚀 feat: 🚀 ship it'))

		expect(parsed?.subject).toBe('ship it')
		expect(parsed?.type).toBe('feat')
	})

	test('extracts the changelog block and trims it', async () => {
		const parsed = await parseGitCommit(
			rawCommit('fix: handle input', '\n::: changelog\n  Handles empty input.  \n:::'),
		)

		expect(parsed?.changelogBody).toBe('Handles empty input.')
	})

	test('recognizes breaking changes in the body', async () => {
		const parsed = await parseGitCommit(
			rawCommit('fix: migrate config', 'BREAKING CHANGE: config format changed'),
		)

		expect(parsed?.isBreaking).toBe(true)
	})

	test('ignores non-conventional commit messages', async () => {
		expect(await parseGitCommit(rawCommit('Update documentation'))).toBeUndefined()
	})
})

describe('parseCommits', () => {
	test('filters invalid commits while preserving valid commit order', async () => {
		const parsed = await parseCommits([
			rawCommit('fix: first'),
			rawCommit('not conventional'),
			rawCommit('feat: second'),
		])

		expect(parsed.map(({ subject }) => subject)).toEqual(['first', 'second'])
	})
})
