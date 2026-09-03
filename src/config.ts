import type {
	GitpaperConfiguration,
	ResolvedGitpaperConfiguration,
	NotYetResolvedGitpaperConfiguration,
} from './types.d'

import { getCurrentRepoInfo } from './git'

export function defineConfig(config: GitpaperConfiguration): GitpaperConfiguration {
	return config
}

export const defaultConfig: GitpaperConfiguration = {
	contributors: true,
	emoji: true,
	excludeBots: true,
	excludeContributors: [],
	experimental: {
		generateOverview: false,
	},
	resolveContributorsGitHub: true,
	types: {
		feat: '🚀 Enhancements',
		fix: '🩹 Fixes',
		perf: '⚡ Performance',
		types: '🌊 Types',
	},
} as const

export async function resolveConfig(options: GitpaperConfiguration): Promise<ResolvedGitpaperConfiguration> {
	const { loadConfig } = await import('c12'),
		{ config } = await loadConfig<NotYetResolvedGitpaperConfiguration>({
			// @ts-expect-error - FIXME:
			defaults: defaultConfig,
			name: 'gitpaper',
			// @ts-expect-error - FIXME:
			overrides: options,
			packageJson: 'gitpaper',
		})

	if (typeof config.repo === 'string') {
		// @ts-expect-error: String split type narrowing for repo parsing
		const [owner, repoName]: [string, string] = config.repo.split('/')
		config.repo = { owner, repo: repoName }
	} else {
		config.repo ??= await getCurrentRepoInfo()
	}

	return {
		...config,
		repo: config.repo,
	}
}
