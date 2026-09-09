import { describe, expect, test } from 'bun:test'

import { buildContributorList, resolveCommitAuthor } from '../src/changelog/contributors'
import { author, commit, config } from './fixtures'

describe('resolveCommitAuthor', () => {
	test('removes duplicate co-authors matching the primary author by email or name', async () => {
		const primary = author('Alice', 'alice@example.com')
		const resolved = await resolveCommitAuthor(
			commit({
				author: primary,
				coAuthors: [primary, author('Alice', 'other@example.com'), author('Bob', 'bob@example.com')],
			}),
			config({ contributors: false }),
		)

		expect(resolved.coAuthors).toEqual([author('Bob', 'bob@example.com')])
	})
})

describe('buildContributorList', () => {
	test('deduplicates contributors by email', () => {
		const alice = author()
		const sections = [
			{
				title: 'Fixes',
				commits: [commit({ author: alice, coAuthors: [alice, author('Bob', 'bob@example.com')] })],
			},
		]

		expect(buildContributorList(sections, config())).toEqual([alice, author('Bob', 'bob@example.com')])
	})

	test('returns undefined when contributors are disabled', () => {
		expect(buildContributorList([], config({ contributors: false }))).toBeUndefined()
	})
})
