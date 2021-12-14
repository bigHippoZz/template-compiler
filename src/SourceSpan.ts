export class SourceFile {
	public lines: Array<{ source: string; line: number }> = [];
	public linesLen: number;
	public sourceLength: number;
	constructor(public content: string) {
		this.sourceLength = content.length;
		this._parseLine();
		this.linesLen = this.lines.length;
	}
	private _parseLine() {
		let startLocation = 0;
		let index = 0;
		let line = 1;
		while (index < this.sourceLength) {
			const shouldBreak = this._parseBreak(index);
			if (!shouldBreak) {
				index++;
			} else {
				this.lines.push({
					source: this.content.slice(startLocation, index),
					line: line++,
				});

				startLocation = index;
				index += shouldBreak;
			}
		}
		this.lines.push({
			source: this.content.slice(startLocation),
			line,
		});
	}

	private _parseBreak(index: number) {
		let len = 0;
		const [l, r] = [this.content[index], this.content[index + 1]];
		if (l === "\r" && r === "\n") len = 2;
		else if (l === "\r" || l === "\n") len = 1;
		return len;
	}
}

export class SourceLocation {
	constructor(
		public sourceFile: SourceFile,
		public offset: number,
		public line: number,
		public column: number
	) {}

	public getLines(maxLine: number = 3) {
		const prevLineIndex = this.line - Math.min(maxLine, this.line);
		const nextLineIndex =
			Math.min(this.sourceFile.linesLen - this.line, maxLine) + this.line;
		return {
			beforeLine: this.sourceFile.lines.slice(prevLineIndex, this.line),
			currentLine: this.sourceFile.lines[this.line],
			nextLine: this.sourceFile.lines.slice(
				this.line + 1,
				nextLineIndex + 1
			),
			maxIndexLen: (nextLineIndex + 1).toString().length,
		};
	}

	public showLines() {
		// TODO: 这里写复杂了性能蛮差 有时间看看react.js的处理方式
		const RE = /^\r?\n?/g;
		const { beforeLine, currentLine, nextLine, maxIndexLen } =
			this.getLines();

		const segmentation = (lines: Array<{ source: string; line: number }>) =>
			lines.reduce((prev, cur) => {
				return (
					prev +
					`  ${" ".repeat(maxIndexLen - cur.line.toString().length)}${
						cur.line
					} |${" ".repeat(4)}` +
					cur.source.replace(RE, "") +
					"\n"
				);
			}, "");
		const message =
			`\n${segmentation(beforeLine)}` +
			`> ${" ".repeat(maxIndexLen - currentLine.line.toString().length)}${
				currentLine.line
			} |${" ".repeat(4)}${currentLine.source.replace(RE, "")}\n` +
			`   ${" ".repeat(maxIndexLen + 4 + this.column)}^\n` +
			`${segmentation(nextLine)}`;
		return message;
	}
}

export class SourceSpan {
	constructor(
		public start: SourceLocation,
		public end: SourceLocation,
		public fullStart: SourceLocation = start,
		public details: string | null = null
	) {}
	toString(): string {
		return this.start.sourceFile.content.slice(
			this.start.offset,
			this.end.offset
		);
	}
}
