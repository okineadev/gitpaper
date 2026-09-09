import { mock } from 'bun:test'

// oxlint-disable-next-line typescript/no-floating-promises
mock.module('../src/github', () => ({
	githubUser: async (): Promise<undefined> => undefined,
}))
