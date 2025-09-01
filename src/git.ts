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

export async function getLastGitTag(to: string): Promise<string> {
	return (await execa('git', ['describe', '--abbrev=0', '--tags', `${to}^`])).stdout
}

export async function getFirstGitCommit(): Promise<string> {
	return (await $`git rev-list --max-parents=0 HEAD`).stdout
}

export async function getCurrentGitBranch(): Promise<string> {
	return (await $`git tag --points-at HEAD`).stdout || (await $`git rev-parse --abbrev-ref HEAD`).stdout
}

export async function getGitDiff(from: string | undefined, to = 'HEAD'): Promise<RawGitCommit[]> {
	const divider = '=== gitpaper commit log divider ==='
	const fromTo = from ? `${from}...${to}` : to
	// https://git-scm.com/docs/pretty-formats
	const prettyFormat = `${divider}%n%s|%H|%an|%ae%n%b`

	const r = (await $('git', ['--no-pager', 'log', fromTo, `--pretty=${prettyFormat}`])).stdout

	return r
		.split(`${divider}\n`)
		.splice(1)
		.map((line) => {
			const [firstLine, ...body] = line.split('\n')
			const [message, hash, authorName, authorEmail] = firstLine.split('|')
			const r: RawGitCommit = {
				message,
				hash,
				author: { name: authorName, email: authorEmail },
				body: body.join('\n'),
			}
			return r
		})
}

export function parseCommits(
	commits: RawGitCommit[],
	// config: ChangelogConfig,
): GitCommit[] {
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
const CoAuthoredByRegex = /^Co-authored-by: (?<name>[^s].+) (?:<(?<email>[^s].+[^s])>)$/gim
// const PullRequestRE = /\([ a-z]*(#\d+)\s*\)/gm
// const IssueRE = /(#\d+)/gm

function extractChangelogBody(body: string): string | undefined {
	const match = body.match(/::: changelog\s*([\s\S]*?):::/im)
	if (!match) return undefined
	return match[1] ? match[1].trim() : undefined
}

export function parseGitCommit(
	commit: RawGitCommit,
	// config: ChangelogConfig,
): GitCommit | null {
	const match = commit.message.match(ConventionalCommitRegex)
	if (!match) {
		return null
	}

	const type: ChangeType = (match.groups?.type as ChangeType) || ('' as ChangeType)
	const hasBreakingBody = /breaking change:/i.test(commit.body)

	const scope = match.groups?.scope || ''

	const isBreaking = Boolean(match.groups?.breaking || hasBreakingBody)
	const description = match.groups?.description as string

	// Find all authors
	const authors: GitCommitAuthor[] = [commit.author]

	for (const match of commit.body.matchAll(CoAuthoredByRegex)) {
		if (match.groups) {
			authors.push({
				name: (match.groups.name || '').trim(),
				email: (match.groups.email || '').trim(),
			})
		}
	}

	const changelogBody = extractChangelogBody(commit.body)
	return {
		hash: commit.hash,
		body: commit.body,
		author: commit.author,
		authors,
		description,
		type,
		scope,
		isBreaking,
		changelogBody,
	}
}
