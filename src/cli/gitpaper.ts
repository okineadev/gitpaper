import fs from 'node:fs/promises'
import path from 'node:path'
import { type GoogleGenerativeAIProviderOptions, google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { Command } from 'commander'
import Handlebars from 'handlebars'
import { resolveConfig } from '@/config'
import { sendRelease } from '@/github'
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
	.option('--no-contributors', 'do not show contributors section')
	.option('--emoji', 'Use emojis in section titles')
	.option('--no-emoji', 'do not use emojis in section titles')
	.option('--generateOverview', 'Add AI generated overview (experimental)')
	.option('--release', 'Release')
	.option('--release-name <name>', 'Release name')
	.option('--draft', 'Mark release as draft')
	.option('--prerelease', 'Mark release as prerelease')
	.action(async (args) => {
		const to = args.to || (await getCurrentGitBranch())
		const from = args.from || (await getLastGitTag(to)) || (await getFirstGitCommit())

		const config = await resolveConfig(args)

		const diff = await getGitDiff(from, to)
		const commits = await parseCommits(diff)

		let changelog = await generateChangelog(commits, config, from, to)

		if (config.experimental.generateOverview) {
			const prompt = await fs.readFile(path.resolve(__dirname, '../ai/prompts/overview-generator.json'), {
				encoding: 'utf-8',
			})
			const AIGeneratedOverview = (
				await generateText({
					model: google('gemini-2.5-flash'),

					providerOptions: {
						google: <GoogleGenerativeAIProviderOptions>{
							thinkingConfig: {
								// Do not think
								thinkingBudget: 0,
								includeThoughts: false,
							},
						},
					},

					prompt: prompt.replace('{{changelog}}', changelog),
				})
			).text

			Handlebars.registerHelper('splitLines', (text: string) => text.split(/\r?\n/))

			const AIOverviewTemplate = Handlebars.compile(
				await fs.readFile(path.resolve(__dirname, '../template/partials/ai-overview.hbs'), {
					encoding: 'utf-8',
				}),
			)

			changelog = `${AIOverviewTemplate({ AIGeneratedOverview })}\n\n${changelog}`
		}

		if (args.release) {
			if (!process.env.GITHUB_TOKEN) {
				console.error('GITHUB_TOKEN environment variable is not set')
				process.exit(1)
			}

			await sendRelease(config.repo, {
				to,
				token: process.env.GITHUB_TOKEN,
				changelog,
				name: args.releaseName,
				draft: args.draft,
				prerelease: args.prerelease,
			})
		} else {
			console.log(changelog)
		}

		process.exit(0)
	})
	.addHelpText('after', '\nGitHub: https://github.com/okineadev/gitpaper')

program.parseAsync(process.argv)
