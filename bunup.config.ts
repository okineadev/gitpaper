import { $ } from 'bun'
import { type DefineConfigItem, defineConfig } from 'bunup'
import { exports } from 'bunup/plugins'

// 🩼
type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

export default defineConfig({
	banner: '// Built with bunup (https://bunup.dev)',
	dts: { entry: ['src/index.ts'] },
	entry: ['src/index.ts', 'src/cli/gitpaper.ts'],
	async onSuccess() {
		await Promise.all([
			$`sed -z -i 's/export {[[:space:]]*generateChangelog[[:space:]]*};\n//g'  dist/index.mjs`,

			(async (): Promise<void> => {
				// Add shebang for the bin entrypoint
				await $`sed -i '1s;^;#!/usr/bin/env node\n;' dist/cli/gitpaper.mjs`

				await $`sed -i 's/}\ from "\.\.\/index\.js";/} from "..\/index.mjs";/' dist/cli/gitpaper.mjs`
			})(),

			// Copy folders
			$`cp -r src/template dist`,
			$`mkdir -p dist/ai && cp -r src/ai/prompts dist/ai/prompts`,
		])
	},
	plugins: [exports()],
	shims: true,
	// oxlint-disable-next-line typescript/no-unnecessary-type-assertion
}) as DefineConfigItem | WithRequired<DefineConfigItem, 'name'>[]
