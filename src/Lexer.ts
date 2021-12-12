import { Cursor, SourceSpan } from "./CursorState";
import {
	CharCodes,
	isAsciiLetter,
	isNameEnd,
	isNotWhitespace,
} from "./CharCodes";
import { Diagnostic } from "./Diagnostic";

export enum State {
	TAG_OPEN_START,
	TAG_OPEN_END,
	TAG_OPEN_END_VOID,
	TAG_CLOSE,

	TEXT,

	COMMENT_START,
	COMMENT_END,

	CDATA_START,
	CDATA_END,

	DOC_TYPE,

	ATTR_NAME,
	ATTR_QUOTE,
	ATTR_VALUE,

	EOF,
	RAW_TEXT,

	INTERPOLATION,
}

export class Token {
	constructor(
		public type: State,
		public parts: string[],
		public span: SourceSpan
	) {}
}

const defaultOptions = {
	interpolationConf: ["{{", "}}"],
};

export class Lexer {
	public tokens: Token[] = [];

	constructor(
		public cursor: Cursor,
		public diagnostic: Diagnostic,
		public options: { interpolationConf: Array<string> } = defaultOptions
	) {}

	public lex() {
		try {
			while (this.cursor.shouldStop()) {
				const start = this.cursor.clone();
				if (this._attemptCharCode(CharCodes.LowerToken)) {
					if (this._attemptCharCode(CharCodes.ExclamationMark)) {
						// <!-- some -->
						if (this._attemptCharCode(CharCodes.Dash)) {
							this._consumeComment(start);
						} else if (this._attemptCharCode(CharCodes.Brackets)) {
							// <![CDATA[ some ]]>
							this._consumeCData(start);
						} else {
							// <!DOCTYPE html>
							this._consumeDocType(start);
						}
					} else if (this._attemptCharCode(CharCodes.Slash)) {
						this._consumeTagClose(start);
					} else {
						this._consumeTagOpen(start);
					}
				} else {
					// hello while {{ a }} hello {{ }}
					this._consumeWithInterpolation(
						State.TEXT,
						State.INTERPOLATION,
						() => this._isTextEnd(),
						() => this._isTagStart()
					);
				}
			}
		} catch (e) {
			console.log(e);
			throw e;
		}
		this._emitToken(State.EOF, [], this.cursor.clone());
	}
	private _consumeDocType(start: Cursor) {
		// <!DOCTYPE html>
		const contentStart = this.cursor.clone();
		this._attemptCharCodeUntil(CharCodes.GreaterToken);
		const content = this.cursor.getSection(contentStart);
		this.cursor.advance();
		this._emitToken(State.DOC_TYPE, [content], start);
	}

	private _consumeCData(start: Cursor) {
		this._matchingStr("CDATA[");
		this._emitToken(State.CDATA_START, [], start);

		this._consumeRawText(() => this._attemptStr("]]>"));

		const CDataEndPos = this.cursor.clone();
		this._matchingStr("]]>");
		this._emitToken(State.CDATA_END, [], CDataEndPos);
	}

	private _consumeComment(start: Cursor) {
		this._matchingCharCode(CharCodes.Dash);
		this._emitToken(State.COMMENT_START, [], start);

		this._consumeRawText(() => this._attemptStr("-->"));

		const commentEndPos = this.cursor.clone();
		this._matchingStr("-->");
		this._emitToken(State.COMMENT_END, [], commentEndPos);
	}

	private _matchingStr(chars: string) {
		if (!this._attemptStr(chars)) {
			this.diagnostic.reportUnexpectedCharacter(this.cursor);
		}
	}

	private _consumeRawText(endMarker: () => boolean) {
		const start = this.cursor.clone();
		const parts: string[] = [];
		while (this.cursor.shouldStop()) {
			const position = this.cursor.clone();
			const foundEndMarker = endMarker();
			this.cursor = position;
			if (foundEndMarker) {
				break;
			}
			parts.push(this._readChar());
		}

		this._emitToken(
			State.RAW_TEXT,
			[this._processCarriageReturns(parts.join(""))],
			start
		);
	}

	private _processCarriageReturns(chars: string): string {
		return chars.replace(/\r\n?/g, "\n");
	}

	private _readChar(): string {
		const char = String.fromCharCode(this.cursor.peek());
		this.cursor.advance();
		return char;
	}

	private _consumeTagOpen(start: Cursor) {
		if (!isAsciiLetter(this.cursor.peek())) {
			this.diagnostic.reportUnexpectedCharacter(this.cursor);
		}
		// <div a />
		// <div />
		// <div >
		// <div
		//    a
		//    v-if
		//    >
		const tagName = this._consumeTagOpenStart(start);
		// skip whitespace
		this._attemptCharCodeUntilFn(isNotWhitespace);
		while (
			this.cursor.peek() !== CharCodes.Slash &&
			this.cursor.peek() !== CharCodes.GreaterToken &&
			this.cursor.peek() !== CharCodes.EOF
		) {
			this._consumeAttribute();
			// skip whitespace
			this._attemptCharCodeUntilFn(isNotWhitespace);
		}
		this._consumeTagOpenEnd(tagName);
	}
	private _consumeTagOpenEnd(tagName: string) {
		const start = this.cursor.clone(),
			code = this.cursor.peek();
		if (code === CharCodes.Slash) {
			this._matchingStr("/>");
			this._emitToken(State.TAG_OPEN_END_VOID, [tagName], start);
		} else if (code === CharCodes.GreaterToken) {
			this._matchingCharCode(CharCodes.GreaterToken);
			this._emitToken(State.TAG_OPEN_END, [tagName], start);
		} else {
			this.diagnostic.reportUnexpectedCharacter(start);
		}
	}

	private _consumeAttribute() {
		this._consumeAttributeName();
		if (this._attemptCharCode(CharCodes.EqualToken)) {
			this._consumeAttributeValue();
		}
	}

	private _consumeAttributeName() {
		const start = this.cursor.clone();
		const attrName = this._consumeName();
		this._emitToken(State.ATTR_NAME, [attrName], start);
	}

	private _consumeAttributeValue() {
		// { } '' ""
		const expectedCode = this.cursor.peek();

		if (
			expectedCode !== CharCodes.DoubleQuote &&
			expectedCode !== CharCodes.SingleQuote
		) {
			this.diagnostic.reportUnexpectedCharacter(this.cursor);
		}

		this._consumeQuote(expectedCode);
		const start = this.cursor.clone();
		this._matchingCharCodeUntilFn((code) => code === expectedCode, 1);
		this._emitToken(
			State.ATTR_VALUE,
			[this.cursor.getSection(start)],
			start
		);
		this._consumeQuote(expectedCode);
	}

	private _consumeQuote(code: number) {
		const start = this.cursor.clone();
		this._matchingCharCode(code);
		this._emitToken(State.ATTR_QUOTE, [String.fromCharCode(code)], start);
	}

	private _consumeName() {
		const location = this.cursor.clone();
		this._matchingCharCodeUntilFn(isNameEnd, 1);
		const name = this.cursor.getSection(location);
		return name;
	}

	private _consumeTagOpenStart(start: Cursor): string {
		const tagName = this._consumeName();
		this._emitToken(State.TAG_OPEN_START, [tagName], start);
		return tagName;
	}

	private _consumeTagClose(start: Cursor) {
		// <div></div>
		const tagName = this._consumeName();
		this._matchingCharCode(CharCodes.GreaterToken);
		this._emitToken(State.TAG_CLOSE, [tagName], start);
	}

	private _consumeWithInterpolation(
		textToken: State,
		interpolationToken: State,
		endMarkerWithText: () => boolean,
		endMarkerWithInterpolation: () => boolean
	) {
		let textStart = this.cursor.clone();
		let parts: string[] = [];
		const [interpolationTokenStart] = this.options.interpolationConf;
		while (!endMarkerWithText()) {
			const current = this.cursor.clone();
			if (this._attemptStr(interpolationTokenStart)) {
				this._emitToken(textToken, parts, textStart, current);
				parts = [];
				this._consumeInterpolation(
					interpolationToken,
					current,
					endMarkerWithInterpolation
				);
				textStart = this.cursor.clone();
			} else {
				parts.push(this._readChar());
			}
		}
		this._emitToken(textToken, parts, textStart);
	}

	private _consumeInterpolation(
		interpolationToken: State,
		interpolationStart: Cursor,
		endMarkerWithInterpolation: () => boolean
	) {
		const parts: string[] = [];

		const [interpolationTokenStart, interpolationTokenEnd] =
			this.options.interpolationConf;
		parts.push(interpolationTokenStart);

		const expressionStart = this.cursor.clone();

		while (
			this.cursor.peek() !== CharCodes.EOF &&
			!endMarkerWithInterpolation()
		) {
			const current = this.cursor.clone();

			if (this._isTagStart()) {
				this.cursor = current;
				parts.push(this._getProcessedChars(expressionStart, current));
				this._emitToken(interpolationToken, parts, interpolationStart);
				return;
			}

			if (this._attemptStr(interpolationTokenEnd)) {
				parts.push(this._getProcessedChars(expressionStart, current));
				parts.push(interpolationTokenEnd);
				this._emitToken(interpolationToken, parts, interpolationStart);
				return;
			}

			this.cursor.advance();
		}

		parts.push(
			this._getProcessedChars(expressionStart, this.cursor.clone())
		);

		this._emitToken(interpolationToken, parts, interpolationStart);
	}

	private _getProcessedChars(start: Cursor, end: Cursor) {
		return this._processCarriageReturns(end.getSection(start));
	}

	private _isTextEnd() {
		if (this._isTagStart() || this.cursor.peek() === CharCodes.EOF) {
			return true;
		}
		return false;
	}

	private _isTagStart() {
		if (this.cursor.peek() === CharCodes.LowerToken) {
			const tmp = this.cursor.clone();
			tmp.advance();
			const code = tmp.peek();
			if (
				isAsciiLetter(code) ||
				code === CharCodes.ExclamationMark ||
				code === CharCodes.Slash
			) {
				return true;
			}
		}
		return false;
	}

	private _attemptCharCodeUntilFn(endMarkerFn: (code: number) => boolean) {
		while (!endMarkerFn(this.cursor.peek())) {
			this.cursor.advance();
		}
	}

	private _attemptCharCodeUntil(code: number) {
		while (this.cursor.peek() !== code) {
			this.cursor.advance();
		}
	}

	private _attemptCharCode(code: number) {
		if (this.cursor.peek() === code) {
			this.cursor.advance();
			return true;
		}
		return false;
	}

	private _attemptStr(str: string) {
		const length = str.length;
		if (this.cursor.getCharRight() < length) {
			return false;
		}
		const position = this.cursor.clone();

		for (let i = 0; i < length; i++) {
			if (!this._attemptCharCode(str.charCodeAt(i))) {
				this.cursor = position;
				return false;
			}
		}
		return true;
	}

	private _matchingCharCode(code: number) {
		if (!this._attemptCharCode(code)) {
			this.diagnostic.reportUnexpectedCharacter(this.cursor);
		}
	}

	private _matchingCharCodeUntilFn(
		endMarkerFn: (code: number) => boolean,
		length?: number
	) {
		const location = this.cursor.clone();
		this._attemptCharCodeUntilFn(endMarkerFn);
		if (length && this.cursor.diff(location) < length) {
			this.diagnostic.reportUnexpectedCharacter(location);
		}
	}
	private _emitToken(
		type: State,
		parts: Array<string>,
		start: Cursor,
		end?: Cursor
	) {
		this.tokens.push(
			new Token(type, parts, (end ?? this.cursor).getTextSpan(start))
		);
	}
}
