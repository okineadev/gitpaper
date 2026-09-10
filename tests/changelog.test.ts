import { expect, test } from 'bun:test'

import { generateChangelog } from '../src'
import { author, commit, config } from './fixtures'

test('renders a complete changelog snapshot', async () => {
	const changelog = await generateChangelog(
		[
			commit({
				author: author('Alice', 'alice@example.com'),
				body: '::: changelog\nThis is a deliberately long release note that explains the user-facing behavior in detail.\n\nIt preserves blank lines and supports examples:\n\n```ts\nconst enabled = true\nconsole.log(enabled)\n```\n\nThe final paragraph confirms that the migration is safe.\n:::',
				changelogBody:
					'This is a deliberately long release note that explains the user-facing behavior in detail.\n\nIt preserves blank lines and supports examples:\n\n```ts\nconst enabled = true\nconsole.log(enabled)\n```\n\nThe final paragraph confirms that the migration is safe.',
				hash: '1234567890abcdef',
				scope: 'release',
				subject: 'publish the new release workflow',
			}),
			commit({
				author: author('Bob', 'bob@example.com'),
				coAuthors: [author('Carol', 'carol@example.com'), author('Dan', 'dan@example.com')],
				hash: 'fedcba0987654321',
				isBreaking: true,
				scope: 'config',
				subject: 'rename the release configuration key',
				type: 'fix',
			}),
		],
		config({ resolveContributorsGitHub: false }),
		'v1.2.0',
		'v1.3.0',
	)

	expect(changelog).toMatchSnapshot()
})
