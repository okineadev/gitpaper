import { Command } from 'commander'
import { resolveConfig } from '@/config'
import { version as VERSION } from '../../package.json'
import { generateChangelog } from '..'
import { getCurrentGitBranch, getFirstGitCommit, getGitDiff, getLastGitTag, parseCommits } from '../git'

const program = new Command()

program
	.name('gitpaper')
	.version(VERSION, '-v, --version')
	.description('Generate changelog from git commits')
	.option('--from <ref>', 'From tag')
	.option('--to <ref>', 'To tag')
	.option('--contributors', 'Show contributors section')
	.option('--emoji', 'Use emojis in section titles', true)
	.option('--no-emoji', 'Do not use emojis in section titles')
	.action(async (args) => {
		const to = args.to || (await getCurrentGitBranch())
		const from = args.from || (await getLastGitTag(to)) || (await getFirstGitCommit())

		const config = await resolveConfig(args)

		const diff = await getGitDiff(from, to)
		const commits = parseCommits(diff)

		const changelog = await generateChangelog(commits, config, from, to)

		console.log(changelog)
		process.exit(0)
	})
	.addHelpText('after', '\nGitHub: https://github.com/okineadev/gitpaper')

program.parseAsync(process.argv)
