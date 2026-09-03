import { program } from '@commander-js/extra-typings'

import addAIOverview from '@/ai/overview'
import { resolveConfig } from '@/config'
import { sendRelease } from '@/github'

import { generateChangelog } from '..'
import { version as VERSION } from '../../package.json'
import { getCurrentGitBranch, getFirstGitCommit, getGitDiff, getLastGitTag, parseCommits } from '../git'

interface ReleaseArgs {
	release?: boolean
	releaseName?: string
	draft?: boolean
	prerelease?: boolean
}

interface ReleaseContext {
	repo: Awaited<ReturnType<typeof resolveConfig>>['repo']
	args: ReleaseArgs
	changelog: string
	to: string
}

async function handleRelease({ repo, args, changelog, to }: ReleaseContext): Promise<void> {
	if (args.release !== true) {
		console.log(changelog)
		return
	}

	if (process.env['GITHUB_TOKEN'] === undefined) {
		throw new Error('GITHUB_TOKEN environment variable is not set')
	}

	await sendRelease(repo, {
		changelog,
		draft: args.draft,
		name: args.releaseName,
		prerelease: args.prerelease,
		to,
		token: process.env['GITHUB_TOKEN'],
	})
}

program
	.name('gitpaper')
	.version(VERSION, '-v, --version')
	.description('Generate changelog from git commits')
	.option('--from <ref>', 'From tag')
	.option('--to <ref>', 'To tag')
	.option('--contributors', 'Show contributors section')
	.option('--no-contributors', 'do not show contributors section')
	.option('--emoji', 'Use emojis in section titles')
	.option('--no-emoji', 'do not use emojis in section titles')
	.option('--generateOverview', 'Add AI generated overview (experimental)')
	.option('--release', 'Release')
	.option('--release-name <name>', 'Release name')
	.option('--draft', 'Mark release as draft')
	.option('--prerelease', 'Mark release as prerelease')
	.action(async (args) => {
		/*     oxlint-disable typescript/prefer-nullish-coalescing typescript/strict-boolean-expressions */
		const to = args.to || (await getCurrentGitBranch()),
			from = args.from || (await getLastGitTag(to)) || (await getFirstGitCommit()),
			/* oxlint-enable typescript/prefer-nullish-coalescing typescript/strict-boolean-expressions*/
			config = await resolveConfig(args),
			diff = await getGitDiff(from, to),
			commits = await parseCommits(diff)

		let changelog = await generateChangelog(commits, config, from, to)

		if (config.experimental.generateOverview === true) {
			changelog = await addAIOverview(changelog)
		}

		await handleRelease({ args, changelog, repo: config.repo, to })

		// oxlint-disable-next-line unicorn/no-process-exit
		process.exit(0)
	})
	.addHelpText('after', '\nGitHub: https://github.com/okineadev/gitpaper')

program.parse()
