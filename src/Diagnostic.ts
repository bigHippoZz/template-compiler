import { isNumber } from "./utils";

export class Diagnostic {
	public _report(message: string) {
		throw new Error(message);
	}
	public reportUnexpectedCharacter(character: number | string) {
		character = isNumber(character)
			? String.fromCharCode(character)
			: character;
		const message = `Unexpected character "${character}" (${1 /* line */},${
			1 /* column */
		})`;
		this._report(message);
	}
}
