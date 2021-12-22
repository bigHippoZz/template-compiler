import { ParseLocation, ParseSourceFile, ParseSourceSpan } from './ParseSourceFile';
import { CharCodes, isNewLine } from './CharCodes';

export class CursorState {
	constructor(
		public peek: number = -1,
		public offset: number = 0,
		public line: number = 0,
		public column: number = 0,
	) {}
}

export class Cursor {
	private _state: CursorState;
	private _file: ParseSourceFile;

	constructor(cursor: Cursor);
	constructor(file: ParseSourceFile);
	constructor(cursor: Cursor | ParseSourceFile) {
		if (cursor instanceof Cursor) {
			this._file = cursor._file;
			this._state = { ...cursor._state };
		} else {
			this._file = cursor;
			this._state = new CursorState();
			this._updatePeek();
		}
	}

	private get _length() {
		return this._file.input.length;
	}

	private get _input() {
		return this._file.input;
	}

	public advance() {
		this._updateState();
	}

	public startWith(str: string, position: number = this._state.offset) {
		return this._input.startsWith(str, position);
	}

	public foresight(code: number) {
		const char = String.fromCharCode(code);
		return this._input.indexOf(char, this._state.offset) >= 0;
	}

	public peek() {
		return this._state.peek;
	}

	public clone() {
		return new Cursor(this);
	}

	public diff(other: this) {
		return this._state.offset - other._state.offset;
	}

	public getChar(start: this) {
		return this._input.substring(start._state.offset, this._state.offset);
	}

	public charAt(pos: number) {
		return this._input.charCodeAt(pos);
	}

	public getSpan(start?: this) {
		start = start ?? this;

		const startLocation = this.locationFromCursor(start);

		const endLocation = this.locationFromCursor(this);

		return new ParseSourceSpan(startLocation, endLocation);
	}

	public locationFromCursor(cursor: this) {
		return new ParseLocation(
			cursor._file,
			cursor._state.offset,
			cursor._state.line,
			cursor._state.column,
		);
	}

	public shouldStop() {
		return this._state.offset < this._length;
	}

	private _updateState() {
		if (!this.shouldStop()) {
			throw new Error(`Unexpected Char "EOF" `);
		}
		const currentCharCode = this.charAt(this._state.offset);

		if (currentCharCode === CharCodes.NewLine) {
			this._state.column = 0;
			this._state.line++;
		} else if (!isNewLine(currentCharCode)) {
			this._state.column++;
		}
		this._state.offset++;
		this._updatePeek();
	}

	private _updatePeek() {
		this._state.peek = this.shouldStop()
			? this._input.charCodeAt(this._state.offset)
			: CharCodes.EOF;
	}
}
