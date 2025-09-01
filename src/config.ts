import { getCurrentRepoInfo } from './git'
import type { GitpaperConfiguration, ResolvedGitpaperConfiguration } from './types.d'

export function defineConfig(config: GitpaperConfiguration): GitpaperConfiguration {
	return config
}

export const defaultConfig = {
	types: {
		feat: '🚀 Enhancements',
		perf: '⚡ Performance',
		fix: '🩹 Fixes',
		types: '🌊 Types',
	},
	contributors: true,
	emoji: true,
} as const
defaultConfig satisfies GitpaperConfiguration

export async function resolveConfig(options: GitpaperConfiguration): Promise<ResolvedGitpaperConfiguration> {
	const { loadConfig } = await import('c12')

	const config = await loadConfig<GitpaperConfiguration>({
		name: 'gitpaper',
		defaults: defaultConfig,
		overrides: options,
		packageJson: 'gitpaper',
	}).then((resolvedConfig) => resolvedConfig.config || defaultConfig)

	if (typeof config.repo === 'string') {
		const [owner, repo] = config.repo.split('/')
		config.repo = { owner, repo }
	} else {
		config.repo = config.repo || (await getCurrentRepoInfo())
	}

	return config as ResolvedGitpaperConfiguration
}
