import Handlebars from 'handlebars'
import fs from 'node:fs/promises'
import path from 'node:path'
import { upperFirst } from 'scule'

/**
 * Reads every `.hbs` file in `./template/partials` and registers it
 * with Handlebars under its filename (without extension) as the partial name.
 */
export async function registerPartials(): Promise<void> {
	const partialsDir = path.resolve(import.meta.dirname, '../template/partials'),
		files = await fs.readdir(partialsDir)

	await Promise.all(
		files
			.filter((file) => file.endsWith('.hbs'))
			.map(async (file) => {
				const content = await fs.readFile(path.join(partialsDir, file), { encoding: 'utf8' }),
					name = path.basename(file, '.hbs')
				Handlebars.registerPartial(name, content)
			}),
	)
}

export function registerHelpers(): void {
	const SHORTENED_SHA_LENGTH = 5
	Handlebars.registerHelper('shaShort', (sha: string) => sha.slice(0, SHORTENED_SHA_LENGTH))
	Handlebars.registerHelper('splitLines', (text: string) => text.split(/\r?\n/u))
	Handlebars.registerHelper('upperFirst', upperFirst)
}

/**
 * Loads and compiles the main changelog Handlebars template.
 *
 * @returns A compiled Handlebars template delegate.
 */
export async function loadTemplate(): Promise<HandlebarsTemplateDelegate> {
	const source = await fs.readFile(path.resolve(import.meta.dirname, '../template/changelog.hbs'), {
		encoding: 'utf8',
	})
	return Handlebars.compile(source)
}
