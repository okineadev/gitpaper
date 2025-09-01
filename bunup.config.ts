import { defineConfig } from 'bunup'
import { exports } from 'bunup/plugins'

export default defineConfig({
	entry: ['src/index.ts', 'src/cli/gitpaper.ts'],
	dts: { entry: ['src/index.ts'] },
	plugins: [exports()],

	banner: '// Built with bunup (https://bunup.dev)',

	async onSuccess() {
		const indexMJS = Bun.file('dist/index.mjs')
		const patchedIndexMJS = (await indexMJS.text()).replace('\nexport {\n  generateChangelog\n};\n', '')
		await indexMJS.write(patchedIndexMJS)
	},
})
