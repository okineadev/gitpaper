import { describe, expect, test } from 'bun:test'

import { collectUniqueAuthors, filterCommitsByAllowedAuthors } from '../src/changelog/authors'
import { author, commit, config } from './fixtures'

describe('collectUniqueAuthors', () => {
	test('deduplicates authors by name and email', () => {
		const alice = author()
		const authors = collectUniqueAuthors([commit({ author: alice }), commit({ author: alice })], config())

		expect([...authors.values()]).toEqual([alice])
	})

	test('excludes bots and configured names or emails', () => {
		const bot = author('dependabot[bot]', 'bot@example.com')
		const excluded = author('Bob', 'bob@example.com')
		const included = author('Carol', 'carol@example.com')
		const authors = collectUniqueAuthors(
			[commit({ author: bot }), commit({ author: excluded }), commit({ author: included })],
			config({ excludeContributors: ['Bob'] }),
		)

		expect([...authors.values()]).toEqual([included])
	})

	test('supports an exclusion function', () => {
		const excluded = author('Automation', 'automation@example.com')
		const included = author('Alice', 'alice@example.com')
		const authors = collectUniqueAuthors(
			[commit({ author: excluded }), commit({ author: included })],
			config({ excludeContributors: ({ email }) => email.startsWith('automation') }),
		)

		expect([...authors.values()]).toEqual([included])
	})
})

test('filterCommitsByAllowedAuthors keeps only matching author identities', () => {
	const allowed = author('Alice', 'alice@example.com')
	const commits = [commit({ author: allowed }), commit({ author: author('Bob', 'bob@example.com') })]
	const authors = new Map([[`${allowed.name}|${allowed.email}`, allowed]])

	expect(filterCommitsByAllowedAuthors(commits, authors)).toEqual([commits[0]!])
})
