import { Command } from 'commander'
import packageJSON from '../../package.json'
import { generateChangelog } from '..'
import { getGitDiff, getLastGitTag, parseCommits } from '../git'

const program = new Command()

program
	.name('gitpaper')
	.version(packageJSON.version, '-v, --version')
	.description('Generate changelog from git commits')
	.arguments('[from] [to]')
	.action(async (from?: string, to?: string) => {
		const diff = await getGitDiff(from ? from : await getLastGitTag(), to)
		const commits = parseCommits(diff)
		const changelog = generateChangelog(commits)
		console.log(changelog)
		process.exit(0)
	})
	.addHelpText('after', '\nGitHub: https://github.com/okineadev/gitpaper')

program.parseAsync(process.argv)
