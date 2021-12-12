import { CharCodes, isNewLine } from "./CharCodes";
import { SourceLocation } from "./SourceSpan";

export class SourceSpan {
	constructor(
		public start: SourceLocation,
		public end: SourceLocation,
		public fullStart: SourceLocation = start,
		public details: string | null = null
	) {}
}

export class CursorState {
	constructor(
		public peek: number = 0,
		public offset: number = 0,
		public line: number = 0,
		public column: number = 0
	) {}
}

export class Cursor {
	public length: number = 0;
	public state: CursorState = new CursorState();

	constructor(public source: string) {
		this._updatePeek();
		this.length = this.source.length;
	}

	public peek(): number {
		return this.state.peek;
	}

	public getCharRight() {
		return this.length - this.state.offset;
	}

	public getSection(startCursor: Cursor): string {
		return this.source.slice(startCursor.state.offset, this.state.offset);
	}

	public clone() {
		const cursor = new Cursor(this.source);
		// 浅拷贝
		cursor.state = Object.assign({}, this.state);

		return cursor;
	}

	public diff(location: Cursor) {
		return this.state.offset - location.state.offset;
	}

	public advance() {
		this._updateState();
	}

	public getTextSpan(start?: Cursor): SourceSpan {
		// const fullStart = start;
		start = start || this;
		const startLocation = new SourceLocation(
			start.source,
			start.state.offset,
			start.state.line,
			start.state.column
		);

		const endLocation = new SourceLocation(
			this.source,
			this.state.offset,
			this.state.line,
			this.state.column
		);

		return new SourceSpan(startLocation, endLocation, startLocation);
	}

	public shouldStop() {
		return this.state.peek !== CharCodes.EOF;
	}

	private _updateState() {
		if (!this.shouldStop()) {
			throw new Error('Unexpected character "EOF"' + this);
		}
		this.state.offset++;
		if (this.state.offset === CharCodes.NewLine) {
			this.state.line++;
			this.state.column = 0;
		} else if (!isNewLine(this.state.offset)) {
			this.state.column++;
		}
		this._updatePeek();
	}

	private _updatePeek() {
		this.state.peek =
			this.state.offset < this.source.length
				? this.source.charCodeAt(this.state.offset)
				: CharCodes.EOF;
	}
}
