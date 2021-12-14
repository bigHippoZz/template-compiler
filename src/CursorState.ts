import { CharCodes, isNewLine } from "./CharCodes";
import { SourceLocation, SourceSpan, SourceFile } from "./SourceSpan";

export class CursorState {
	constructor(
		public peek: number = -1,
		public offset: number = 0,
		public line: number = 0,
		public column: number = 0
	) {}
}

export class Cursor {
	private _beforeIsCarriageReturn: boolean = false;
	public state: CursorState = new CursorState();

	constructor(public source: SourceFile) {
		this._updatePeek();
	}

	public peek(): number {
		return this.state.peek;
	}

	public getCharRight() {
		return this.source.sourceLength - this.state.offset;
	}

	public getSection(startCursor: Cursor): string {
		return this.source.content.slice(
			startCursor.state.offset,
			this.state.offset
		);
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
		start = start ?? this;
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

		return new SourceSpan(startLocation, endLocation);
	}

	public shouldStop() {
		return this.state.peek !== CharCodes.EOF;
	}

	public locationFromCursor() {
		return new SourceLocation(
			this.source,
			this.state.offset,
			this.state.line,
			this.state.column
		);
	}

	private _updateState() {
		if (!this.shouldStop()) {
			throw new Error(
				`Unexpected character 'EOF' ` + JSON.stringify(this.state)
			);
		}
		if (
			this.state.peek === CharCodes.CarriageReturn ||
			(this.state.peek === CharCodes.NewLine &&
				!this._beforeIsCarriageReturn)
		) {
			if (this.state.peek === CharCodes.CarriageReturn) {
				this._beforeIsCarriageReturn = true;
			}
			this.state.line++;
			this.state.column = 0;
		} else if (!isNewLine(this.state.peek)) {
			this._beforeIsCarriageReturn = false;
			this.state.column++;
		}
		this.state.offset++;
		this._updatePeek();
	}

	private _updatePeek() {
		this.state.peek =
			this.state.offset < this.source.sourceLength
				? this.source.content.charCodeAt(this.state.offset)
				: CharCodes.EOF;
	}
}
