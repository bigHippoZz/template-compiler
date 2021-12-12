import { Cursor } from "./CursorState";

export class Diagnostic {
	public _report(message: string) {
		throw new Error(message);
	}
	public reportUnexpectedCharacter(cursor: Cursor) {
		console.log(cursor.getTextSpan());
		const message = `Unexpected character "${String.fromCharCode(
			cursor.peek()
		)}" (${cursor.state.line},${cursor.state.column})`;
		console.log(this.getText(2, cursor));
		this._report(message);
	}
	public getText(maxLine: number, cursor: Cursor) {
		const { source, state } = cursor;
		const { offset, line } = state;
		// 向前
		let startOffset = offset;
		let startLine = 0;
		while (startOffset !== 0) {
			startOffset--;
			if (source[startOffset] === "\n") {
				startLine++;
			}

			if (startLine >= maxLine) {
				break;
			}
		}
		// 向后
		let endOffset = offset;
		let endLine = line;
		while (endOffset < source.length) {
			endOffset++;
			if (source[endOffset] === "\n") {
				endLine++;
			}
			if (endLine >= maxLine) {
				break;
			}
		}

		return {
			before: source.slice(startOffset, offset),
			after: source.slice(offset, endOffset),
			content: source.slice(startOffset, endOffset),
		};
	}
}
