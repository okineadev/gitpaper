import { getCurrentRepoInfo } from './git'
import type { GitpaperConfiguration, ResolvedGitpaperConfiguration } from './types.d'

export function defineConfig(config: GitpaperConfiguration): GitpaperConfiguration {
	return config
}

export const defaultConfig: GitpaperConfiguration = {
	types: {
		feat: '🚀 Enhancements',
		perf: '⚡ Performance',
		fix: '🩹 Fixes',
		types: '🌊 Types',
	},
	contributors: true,
	emoji: true,
	experimental: {
		generateOverview: false,
	},
	excludeBots: true,
	resolveContributorsGitHub: true,
} as const

export async function resolveConfig(
	options: GitpaperConfiguration & { generateOverview?: boolean },
): Promise<ResolvedGitpaperConfiguration> {
	const { loadConfig } = await import('c12')

	const config = (await loadConfig<GitpaperConfiguration>({
		name: 'gitpaper',
		defaults: defaultConfig,
		overrides: options,
		packageJson: 'gitpaper',
	}).then((resolvedConfig) => resolvedConfig.config || defaultConfig)) as Required<GitpaperConfiguration>

	if (typeof config.repo === 'string') {
		const [owner, repo] = config.repo.split('/')
		config.repo = { owner, repo }
	} else {
		config.repo = config.repo || (await getCurrentRepoInfo())
	}

	// Overrides
	config.experimental.generateOverview = options.generateOverview || config.experimental?.generateOverview

	return config as ResolvedGitpaperConfiguration
}
