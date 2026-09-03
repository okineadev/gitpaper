import { type GoogleGenerativeAIProviderOptions, google } from '@ai-sdk/google'
import { generateText } from 'ai'
import Handlebars from 'handlebars'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Prepends an AI-generated overview summary to the given changelog using the
 * Gemini model. Reads the prompt and template files from disk.
 *
 * @param changelog - The generated changelog text.
 * @returns The changelog with the AI overview prepended.
 */
async function addAIOverview(changelog: string): Promise<string> {
	const prompt = await fs.readFile(path.resolve(import.meta.dirname, './prompts/overview-generator.json'), {
			encoding: 'utf8',
		}),
		AIGeneratedOverview = (
			await generateText({
				model: google('gemini-2.5-flash'),

				prompt: prompt.replace('{{changelog}}', changelog),

				providerOptions: {
					// oxlint-disable-next-line typescript/no-unnecessary-type-assertion
					google: {
						thinkingConfig: {
							// Do not think
							includeThoughts: false,
							thinkingBudget: 0,
						},
					} as GoogleGenerativeAIProviderOptions,
				},
			})
		).text

	Handlebars.registerHelper('splitLines', (text: string) => text.split(/\r?\n/u))

	// oxlint-disable-next-line one-var
	const aiOverviewTemplate = Handlebars.compile(
		await fs.readFile(path.resolve(import.meta.dirname, '../template/partials/ai-overview.hbs'), {
			encoding: 'utf8',
		}),
	)

	return `${aiOverviewTemplate({ AIGeneratedOverview })}\n\n${changelog}`
}

export default addAIOverview
