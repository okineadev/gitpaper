// import type { ChangelogConfig } from './config'
import { execCommand } from './exec'

export interface GitCommitAuthor {
	name: string
	email: string
}

export interface RawGitCommit {
	message: string
	body: string
	hash: string
	author: GitCommitAuthor
}

export interface GitCommit extends RawGitCommit {
	description: string
	type: string
	scope: string
	authors: GitCommitAuthor[]
	isBreaking: boolean
	changelogBody?: string
}

export async function getLastGitTag(cwd?: string): Promise<string | undefined> {
	try {
		return execCommand('git describe --tags --abbrev=0', cwd)?.split('\n').at(-1)
	} catch {
		// Ignore
	}
}

export async function getGitDiff(
	from: string | undefined,
	to = 'HEAD',
	cwd?: string,
): Promise<RawGitCommit[]> {
	const divider = '=== gitpaper commit log divider ==='
	// https://git-scm.com/docs/pretty-formats
	const r = execCommand(
		`git --no-pager log "${from ? `${from}...` : ''}${to}" --pretty="${divider}%n%s|%H|%an|%ae%n%b"`,
		cwd,
	)
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

	const type = match.groups?.type || ''
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
		...commit,
		authors,
		description,
		type,
		scope,
		isBreaking,
		changelogBody,
	}
}
