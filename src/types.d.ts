import type { defaultConfig } from './config'

export interface Section {
	title: string
	commits: GitCommit[]
}

export type ChangeType = keyof ResolvedGitpaperConfiguration['types']

export interface GitCommitAuthor {
	/**
	 * The name of the person who made the change
	 *
	 * @example 'octocat'
	 */
	name: string
	email: string
}

// oxlint-disable-next-line typescript/ban-types
type CanBeDifferent<T> = T | (T & {})

export interface GitHubUser {
	// Name from GitHub can be different
	name: CanBeDifferent<GitCommitAuthor['name']> | undefined
	username: string
}

export interface ResolvedGitCommitAuthor extends GitCommitAuthor, GitHubUser {}

export interface RawGitCommit {
	message: string
	body: string
	date: string
	hash: string
	author: GitCommitAuthor
	coAuthors: GitCommitAuthor[]
}

export interface GitCommit extends RawGitCommit {
	subject: string
	changelogBody?: string
	type: ChangeType
	scope?: string
	isBreaking: boolean
	author: GitCommitAuthor | ResolvedGitCommitAuthor
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
	 *
	 * @default true
	 */
	emoji?: boolean

	/**
	 * 🧪 Experimental features that may change in future versions.
	 *
	 * @experimental
	 */
	experimental?: {
		/**
		 * Whether to generate AI Overview at the beginning of release notes
		 *
		 * ---
		 *
		 * For context, the generated release notes are taken
		 *
		 * Currently, they are generated only by Gemini (`2.5 Flash`), in the future, support for all providers is planned (for example, **OpenAI**, **xAI** and **Mistral**)
		 *
		 * Gemini 2.5 Flash was chosen due to its high generation speed and free API
		 *
		 * @default false
		 */
		generateOverview?: boolean
	}

	/**
	 * Whether to exclude bot contributors (authors with names ending in [bot]) from release notes.
	 *
	 * @default true
	 */
	excludeBots?: boolean

	/**
	 * Exclude specific contributors from release notes.
	 * Can be an array of names/emails or a function that returns true to exclude.
	 *
	 * @example
	 * excludeContributors: ["octocat", "octocat@github.com"]
	 * excludeContributors: (author) => author.name === "octocat" || author.email.endsWith("@bots.com")
	 */
	excludeContributors?: string[] | ((author: GitCommitAuthor) => boolean)

	/**
	 * Whether to resolve contributors GitHub.
	 *
	 * @default true
	 */
	resolveContributorsGitHub?: boolean
}

export type NotYetResolvedGitpaperConfiguration = Required<Omit<GitpaperConfiguration, 'repo'>> & {
	repo?: RepoInfo | string
}

export type ResolvedGitpaperConfiguration = Required<NotYetResolvedGitpaperConfiguration> & {
	repo: RepoInfo
}
