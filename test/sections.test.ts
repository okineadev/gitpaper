import { describe, expect, test } from 'bun:test'

import { buildSections, groupCommitsByType } from '../src/changelog/sections'
import { commit, config } from './fixtures'

describe('groupCommitsByType', () => {
	test('groups commits and preserves input order within each type', () => {
		const commits = [commit({ type: 'fix' }), commit({ type: 'feat' }), commit({ type: 'fix' })]
		const grouped = groupCommitsByType(commits)

		expect([...grouped.keys()]).toEqual(['fix', 'feat'])
		expect(grouped.get('fix')).toEqual([commits[0]!, commits[2]!])
	})
})

describe('buildSections', () => {
	test('follows configured order and skips disabled or empty types', async () => {
		const sections = await buildSections(
			new Map([
				['fix', [commit({ type: 'fix' })]],
				['chore', [commit({ type: 'chore' })]],
			]),
			config({ types: { feat: '🚀 Enhancements', fix: '🩹 Fixes', chore: false } }),
		)

		expect(sections).toHaveLength(1)
		expect(sections[0]!.title).toBe('🩹 Fixes')
	})

	test('removes emoji from titles when disabled', async () => {
		const sections = await buildSections(new Map([['feat', [commit()]]]), config({ emoji: false }))

		expect(sections[0]!.title).toBe('Enhancements')
	})
})
