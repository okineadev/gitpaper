import { $, execa } from 'execa'
import type { ChangeType, GitCommit, GitCommitAuthor, RawGitCommit, RepoInfo } from './types'

/**
 * Gets the current repository name and owner using gh CLI (preferred) or git commands
 * @returns - Object containing owner and repository name
 * @throws Error if not in a git repository or commands fail
 */
export async function getCurrentRepoInfo(): Promise<RepoInfo> {
	const remoteUrl = (await $`git config --get remote.origin.url`).stdout

	if (!remoteUrl) {
		throw new Error('No remote origin URL found')
	}

	const [owner, repo] = remoteUrl
		.replace(/\.git$/, '')
		.split('/')
		.slice(-2)

	return { owner, repo }
}

export async function getLastGitTag(to: string): Promise<string | undefined> {
	try {
		return (await execa('git', ['describe', '--abbrev=0', '--tags', `${to}^`])).stdout
	} catch {}
}

export async function getFirstGitCommit(): Promise<string> {
	return (await $`git rev-list --max-parents=0 HEAD`).stdout
}

export async function getCurrentGitBranch(): Promise<string> {
	return (await $`git tag --points-at HEAD`).stdout || (await $`git rev-parse --abbrev-ref HEAD`).stdout
}

export async function getGitDiff(from: string | undefined, to = 'HEAD'): Promise<RawGitCommit[]> {
	const fromTo = from ? `${from}...${to}` : to

	const commits = (await $`git --no-pager log ${fromTo} --oneline --pretty=format:%H`).stdout.split('\n')

	return await Promise.all(
		commits.map(async (commit): Promise<RawGitCommit> => {
			// This is the most safe implementation of pulling data about commit from the `git` command
			// It may be a little slower, but it's better than constantly worrying that some fool
			// will put the `|` symbol or another divider we use in his name and break the commit parsing
			// in some repository forever.
			// The chance is low, but never zero.
			const showCommitField = async (commitHash: string, format: string) =>
				(await $`git --no-pager show ${commitHash} -s --format=%${format}`).stdout

			const [message, body, date, author, coAuthors /*, signingStatus */] = await Promise.all([
				// 🗒️ https://git-scm.com/docs/pretty-formats
				showCommitField(commit, 's'),
				showCommitField(commit, 'b'),
				showCommitField(commit, 'at'),
				(async (): Promise<GitCommitAuthor> => {
					const [name, email] = await Promise.all([
						showCommitField(commit, 'an'),
						showCommitField(commit, 'ae'),
					])
					return { name, email }
				})(),

				(async (): Promise<GitCommitAuthor[]> => {
					const coAuthors = (await showCommitField(commit, '(trailers:key=Co-Authored-By,valueonly)')).trim()
					return coAuthors.length
						? coAuthors.split('\n').map(
								(coAuthorString): GitCommitAuthor =>
									// @ts-expect-error
									coAuthorString.match(/^(?<name>[^s].+) (?:<(?<email>[^s].+[^s])>)$/i)
										.groups as unknown as GitCommitAuthor,
							)
						: []
				})(),
				// showCommitField(commit, 'G?'),
			])

			return {
				message,
				body,
				date,
				hash: commit,
				author,
				coAuthors,
				// signingStatus,
			}
		}),
	)
}

export function parseCommits(commits: RawGitCommit[]): GitCommit[] {
	return commits.map(parseGitCommit).filter(Boolean) as GitCommit[]
}

const emojiGroup =
	'(?:' +
	':[a-z_]+:|' + // :emoji:
	'\\uD83C[\\uDF00-\\uDFFF]|' + // emoji range 1
	'\\uD83D[\\uDC00-\\uDE4F\\uDE80-\\uDEFF]|' + // emoji range 2
	'[\\u2600-\\u2B55]' + // misc symbols
	')'

const leadingEmojis = `(?:${emojiGroup}\\s*)*`

// https://сonventionalcommits.org/en/v1.0.0/
// https://regex101.com/r/FSfNvA/1
const ConventionalCommitRegex = new RegExp(
	`^(?<emoji>${emojiGroup})?\\s*` + // optional emoji before type
		`(?<type>[a-z]+)` + // type
		`(?:\\((?<scope>[^)]+)\\))?` + // optional scope
		`(?<breaking>!)?: ` + // optional breaking
		`(?<rawDescription>${leadingEmojis})` + // optional leading emojis in description
		`(?<description>.+)$`, // final cleaned description
	'i',
)

// const humanRegex = /(?<name>[^\s].+) (?:<(?<email>[^\s].+[^\s])>)/gim
// const PullRequestRE = /\([ a-z]*(#\d+)\s*\)/gm
// const IssueRE = /(#\d+)/gm

function extractChangelogBody(body: string): string | undefined {
	const match = body.match(/::: changelog\s*([\s\S]*?):::/im)
	if (!match) return undefined
	return match[1] ? match[1].trim() : undefined
}

export function parseGitCommit(commit: RawGitCommit): GitCommit | null {
	const match = commit.message.match(ConventionalCommitRegex)
	if (!match) {
		return null
	}

	const type: ChangeType = (match.groups?.type as ChangeType) || ('' as ChangeType)
	const hasBreakingBody = /breaking change:/i.test(commit.body)

	const scope = match.groups?.scope || ''

	const isBreaking = Boolean(match.groups?.breaking || hasBreakingBody)
	const subject = match.groups?.description as string

	const changelogBody = extractChangelogBody(commit.body)
	return {
		...commit,
		subject,
		changelogBody,
		type,
		scope,
		isBreaking,
	}
}
