export class TextSpan {
	constructor(
		public source: string,
		public offset: number,
		public line: number,
		public column: number
	) {
		if (this.offset >= this.source.length || isNaN(this.offset)) {
			throw new Error(`Unknown offset position '${this.offset}'`);
		}
	}

	public toString() {
		return `(${this.line},${this.column})`;
	}

	public getText(maxLine: number) {
		// 向前
		let startOffset = this.offset;
		let startLine = this.line;
		while (startOffset !== 0) {
			startOffset--;
			if (this.source[startOffset] === "\n") {
				startLine++;
			}
			if (startLine >= maxLine) {
				break;
			}
		}
		// 向后
		let endOffset = this.offset;
		let endLine = this.line;
		while (endOffset < this.source.length) {
			endOffset++;
			if (this.source[endOffset] === "\n") {
				endLine++;
			}
			if (endLine >= maxLine) {
				break;
			}
		}
		return {
			before: this.source.slice(startOffset, this.offset),
			after: this.source.slice(this.offset, endOffset),
			content: this.source.slice(startOffset, endOffset),
		};
	}
}
