export class SourceLocation {
	constructor(
		public source: string,
		public offset: number,
		public line: number,
		public column: number
	) {
		if (isNaN(this.offset)) {
			throw new Error(`Unknown offset position '${this.offset}'`);
		}
	}

	public toString() {
		return `(${this.line},${this.column})`;
	}

	public getText(maxLine: number = 3) {
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

export class SourceSpan {
	constructor(
		public start: SourceLocation,
		public end: SourceLocation,
		public details: string | null = null
	) {}
}

export class ParseSourceFile {
	constructor(public content: string) {}
}

export class SourceFile {
	public lines: Array<string> = [];
	constructor(
		public content: string,
		public length: number = content.length
	) {
		this._parseLine();
	}

	private _parseLine() {
		let startLocation = 0;
		let index = 0;
		while (index < this.length) {
			const shouldBreak = this._parseBreak(index);
			if (!shouldBreak) {
				index++;
			} else {
				this.lines.push(this.content.slice(startLocation, index));
				startLocation = index;
				index += shouldBreak;
			}
		}
		this.lines.push(this.content.slice(startLocation));
	}

	private _parseBreak(index: number) {
		let len = 0;
		const [l, r] = [this.content[index], this.content[index + 1]];
		if (l === "\r" && r === "\n") len = 2;
		else if (l === "\r" || l === "\n") len = 1;
		return len;
	}
}
