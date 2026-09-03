// oxlint-disable import/prefer-default-export
import { $ as execaDollar } from 'execa'

// oxlint-disable-next-line id-length
export const $ = async (cmd: TemplateStringsArray | string, ...subs: string[]): Promise<string> => {
	const { stdout } = await execaDollar(
		typeof cmd === 'string'
			? cmd
			: cmd.reduce((acc, part, i) => acc + part + (i < subs.length ? String(subs[i]) : ''), ''),
	)
	return stdout
}
