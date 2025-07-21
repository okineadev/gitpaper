import { defineConfig } from 'bunup'

export default defineConfig({
	entry: ['src/index.ts', 'src/cli/gitpaper.ts'],
	dts: {
		entry: ['src/index.ts'],
	},
	banner: '// Built with bunup (https://bunup.dev)',
})
