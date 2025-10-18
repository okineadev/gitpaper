import { $ } from 'bun'
import { defineConfig } from 'bunup'
import { exports } from 'bunup/plugins'

export default defineConfig({
	entry: ['src/index.ts', 'src/cli/gitpaper.ts'],
	dts: { entry: ['src/index.ts'] },
	// @ts-expect-error
	shims: true,
	plugins: [exports()],

	banner: '// Built with bunup (https://bunup.dev)',

	async onSuccess() {
		await Promise.all([
			$`sed -z -i 's/export {[[:space:]]*generateChangelog[[:space:]]*};\n//g'  dist/index.mjs`,

			(async () => {
				// Add shebang for the bin entrypoint
				await $`sed -i '1s;^;#!/usr/bin/env node\n;' dist/cli/gitpaper.mjs`

				await $`sed -i 's/}\ from "\.\.\/index\.js";/} from "..\/index.mjs";/' dist/cli/gitpaper.mjs`
			})(),

			// Copy folders
			$`cp -r src/template dist`,
			$`mkdir -p dist/ai && cp -r src/ai/prompts dist/ai/prompts`,
		])
	},
})
