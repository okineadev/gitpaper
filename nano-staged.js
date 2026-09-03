// oxlint-disable-next-line jsdoc/check-tag-names
/** @type {import('nano-staged').Configuration} */
const config = {
	'*': ['bun run format --no-error-on-unmatched-pattern', 'cspell --no-error-on-empty'],
	'*.{ts,vue}': () => ['bun run lint:oxc'],
}

export default config
