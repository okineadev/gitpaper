import { $, execa } from 'execa'

import type { ChangeType, GitCommit, GitCommitAuthor, RawGitCommit, RepoInfo } from './types'

/**
 * Gets the current repository name and owner using gh CLI (preferred) or git commands
 * @returns - Object containing owner and repository name
 * @throws {Error} if not in a git repository or commands fail
 */
export async function getCurrentRepoInfo(): Promise<RepoInfo> {
	const remoteUrl = (await $`git config --get remote.origin.url`).stdout

	if (!remoteUrl) {
		throw new Error('No remote origin URL found')
	}

	// oxlint-disable-next-line one-var
	const LAST_TWO_PARTS_OF_REMOTE_URL = -2
	// @ts-expect-error: Array destructuring requires type narrowing
	// oxlint-disable-next-line one-var
	const [owner, repo]: [string, string] = remoteUrl
		.replace(/\.git$/u, '')
		.split('/')
		.slice(LAST_TWO_PARTS_OF_REMOTE_URL)

	return { owner, repo }
}

export async function getLastGitTag(to: string): Promise<string | undefined> {
	try {
		return (await execa('git', ['describe', '--abbrev=0', '--tags', `${to}^`])).stdout
	} catch {
		return undefined
	}
}

export async function getFirstGitCommit(): Promise<string> {
	return (await $`git rev-list --max-parents=0 HEAD`).stdout
}

export async function getCurrentGitBranch(): Promise<string> {
	return (await $`git tag --points-at HEAD`).stdout || (await $`git rev-parse --abbrev-ref HEAD`).stdout
}
// This is the most safe implementation of pulling data about commit from the `git` command
// It may be a little slower, but it's better than constantly worrying that some fool
// will put the `|` symbol or another divider we use in his name and break the commit parsing
// in some repository forever.
// The chance is low, but never zero.
const showCommitField = async (commitHash: string, format: string): Promise<string> =>
	(await $`git --no-pager show ${commitHash} -s --format=%${format}`).stdout

export async function getGitDiff(from: string, to = 'HEAD'): Promise<RawGitCommit[]> {
	const fromTo = from ? `${from}...${to}` : to,
		// cspell:disable-next-line
		commits = (await $`git --no-pager log ${fromTo} --oneline --pretty=format:%H`).stdout.split('\n')

	return Promise.all(
		commits.map(async (commit): Promise<RawGitCommit> => {
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
					return { email, name }
				})(),

				(async (): Promise<GitCommitAuthor[]> => {
					const theCoAuthors = // cspell:disable-next-line
						(await showCommitField(commit, '(trailers:key=Co-Authored-By,valueonly)')).trim()
					return theCoAuthors.length > 0
						? theCoAuthors.split('\n').map(
								(coAuthorString): GitCommitAuthor =>
									// @ts-expect-error: Regex groups type narrowing for co-author parsing
									// oxlint-disable-next-line typescript/no-unsafe-type-assertion
									/^(?<name>[^s].+) (?:<(?<email>[^s].+[^s])>)$/iu.exec(coAuthorString)
										.groups as unknown as GitCommitAuthor,
							)
						: []
				})(),
				// ShowCommitField(commit, 'G?'),
			])

			return {
				author,
				body,
				coAuthors,
				date,
				hash: commit,
				message,
				// SigningStatus,
			}
		}),
	)
}

// oxlint-disable-next-line one-var
const emojiSequence = String.raw`\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*`,
	markdownEmoji = ':[a-z_+]+:',
	gitmoji = `(?:${markdownEmoji}|${emojiSequence})`,
	// https://сonventionalcommits.org/en/v1.0.0/
	ConventionalCommitRegex = new RegExp(
		`^(?:${gitmoji}\\s)?` + // Optional emoji before type
			`(?<type>[a-z]+)` + // Type
			`(?:\\((?<scope>[^)]+)\\))?` + // Optional scope
			`(?<breaking>!)?: ` + // Optional breaking
			`(?:${gitmoji}\\s)?` +
			`(?<description>.+)$`,
		'ui',
	)

// Const humanRegex = /(?<name>[^\s].+) (?:<(?<email>[^\s].+[^\s])>)/gim
// const PullRequestRE = /\([ a-z]*(#\d+)\s*\)/gm
// const IssueRE = /(#\d+)/gm

function extractChangelogBody(body: string): string | undefined {
	const match = /::: changelog\s*(?<changelog>[\s\S]*?):::/imu.exec(body)
	// @ts-expect-error: Regex groups optional chaining type narrowing
	return match?.groups?.changelog?.trim()
}

export async function parseGitCommit(commit: RawGitCommit): Promise<GitCommit | undefined> {
	const match = commit.message.match(ConventionalCommitRegex)
	if (!match) {
		return undefined
	}

	// oxlint-disable-next-line one-var typescript/no-unsafe-type-assertion
	const groups = match.groups as {
		type?: ChangeType
		breaking?: string
		description: string
		scope?: string
	}

	// oxlint-disable-next-line one-var
	const type: ChangeType = groups.type ?? '',
		hasBreakingBody = /breaking change:/iu.test(commit.body),
		scope = groups.scope ?? '',
		isBreaking = Boolean(groups.breaking ?? hasBreakingBody),
		subject = groups.description,
		changelogBody = extractChangelogBody(commit.body)
	return {
		...commit,
		changelogBody,
		isBreaking,
		scope,
		subject,
		type,
	}
}

export async function parseCommits(commits: RawGitCommit[]): Promise<GitCommit[]> {
	const parsedCommits = await Promise.all(commits.map(parseGitCommit))
	return parsedCommits.filter((commit): commit is GitCommit => Boolean(commit))
}
