import type { defaultConfig } from './config'

export interface Section {
	title: string
	commits: GitCommit[]
}

export type ChangeType = keyof typeof defaultConfig.types

export interface GitCommitAuthor {
	/**
	 * The name or username of the person who made the change
	 *
	 * @example 'octocat'
	 */
	name: string
	email: string
}

export interface RawGitCommit {
	message: string
	hash: string
	author: GitCommitAuthor
	body: string
}

export interface GitCommit extends Omit<RawGitCommit, 'message'> {
	authors: GitCommitAuthor[]
	description: string
	type: ChangeType
	scope?: string
	isBreaking: boolean
	changelogBody?: string
}

export interface RepoInfo {
	owner: string
	repo: string
}

export interface GitpaperConfiguration {
	/**
	 * Whether to include contributors in release notes.
	 *
	 * @default true
	 */
	contributors?: boolean
	/**
	 * A mapping of change types to their corresponding section titles in the changelog.
	 * Each key represents a type of change (e.g., 'feat', 'fix'), and the value is the
	 * title that will appear in the changelog for that type.
	 */
	types?: Record<string, string | boolean>
	repo?: RepoInfo | string
	/**
	 * Use emojis in section titles
	 * @default true
	 */
	emoji?: boolean
}

export type ResolvedGitpaperConfiguration = Required<Omit<GitpaperConfiguration, 'repo'>> & {
	repo: RepoInfo
}
