import { Cursor } from "./CursorState";
import {
	CharCodes,
	isAsciiLetter,
	isNameEnd,
	isNotWhitespace,
} from "./CharCodes";
import { Diagnostic } from "./Diagnostic";
import { SourceSpan } from "./SourceSpan";

export enum SyntaxTokenType {
	TAG_OPEN_START,
	TAG_OPEN_END,
	TAG_OPEN_END_VOID,
	TAG_CLOSE,

	COMMENT_START,
	COMMENT_END,

	CDATA_START,
	CDATA_END,

	DOC_TYPE,

	ATTR_NAME,
	ATTR_QUOTE,
	ATTR_VALUE,
	ATTR_VALUE_TEXT,
	ATTR_VALUE_INTERPOLATION,

	RAW_TEXT,
	TEXT,

	INTERPOLATION,

	EOF,
}

export class Token {
	constructor(
		public type: SyntaxTokenType,
		public parts: string[],
		public span: SourceSpan
	) {}
}

const defaultOptions = {
	interpolationConf: ["{", "}"],
};

export class InterpolationConfig {
	private static DEFAULT_CONFIG = ["{{", "}}"] as const;
	constructor(
		private _config: readonly [
			string,
			string
		] = InterpolationConfig.DEFAULT_CONFIG
	) {}
	public get start() {
		return this._config[0];
	}
	public get end() {
		return this._config[1];
	}
}

export class Lexer {
	public tokens: Token[] = [];

	private _currentTokenStart: Cursor | null = null;
	private _currentTokenType: SyntaxTokenType | null = null;

	constructor(
		public cursor: Cursor,
		public diagnostic: Diagnostic,
		public options: { interpolationConf: Array<string> } = defaultOptions
	) {}

	public lex() {
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
				this._consumeWithInterpolation(
					SyntaxTokenType.TEXT,
					SyntaxTokenType.INTERPOLATION,
					() => this._isTextEnd(),
					() => this._isTagStart()
				);
			}
		}
		this._beginToken(SyntaxTokenType.EOF);
		this._endToken([]);
	}
	private _consumeDocType(start: Cursor) {
		// <!DOCTYPE html>
		this._beginToken(SyntaxTokenType.DOC_TYPE, start);
		const contentStart = this.cursor.clone();
		this._attemptCharCodeUntil(CharCodes.GreaterToken);
		const content = this.cursor.getSection(contentStart);
		this.cursor.advance();
		this._endToken([content]);
	}

	private _consumeCData(start: Cursor) {
		this._beginToken(SyntaxTokenType.CDATA_START, start);
		this._matchingStr("CDATA[");
		this._endToken([]);

		this._consumeRawText(() => this._attemptStr("]]>"));

		this._beginToken(SyntaxTokenType.CDATA_END, start);
		this._matchingStr("]]>");
		this._endToken([]);
	}

	private _consumeComment(start: Cursor) {
		this._beginToken(SyntaxTokenType.COMMENT_START, start);
		this._matchingCharCode(CharCodes.Dash);
		this._endToken([]);

		this._consumeRawText(() => this._attemptStr("-->"));

		this._beginToken(SyntaxTokenType.COMMENT_END);
		this._matchingStr("-->");
		this._endToken([]);
	}

	private _matchingStr(chars: string) {
		if (!this._attemptStr(chars)) {
			this.diagnostic.reportUnexpectedCharacter(this.cursor);
		}
	}

	private _consumeRawText(endMarker: () => boolean) {
		this._beginToken(SyntaxTokenType.RAW_TEXT);
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
		this._endToken([this._processCarriageReturns(parts.join(""))]);
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
		const start = this.cursor.clone();
		const tokenType = this._attemptCharCode(CharCodes.Slash)
			? SyntaxTokenType.TAG_OPEN_END_VOID
			: SyntaxTokenType.TAG_OPEN_END;
		this._beginToken(tokenType, start);
		this._matchingCharCode(CharCodes.GreaterToken);
		this._endToken([tagName]);
	}

	private _consumeAttribute() {
		this._consumeAttributeName();
		if (this._attemptCharCode(CharCodes.EqualToken)) {
			this._consumeAttributeValue();
		}
	}

	private _consumeAttributeName() {
		this._beginToken(SyntaxTokenType.ATTR_NAME);
		const attrName = this._consumeName();
		this._endToken([attrName]);
	}

	private _consumeAttributeValue() {
		// { } '' ""
		const expectedCode = this.cursor.peek();
		if (
			expectedCode === CharCodes.DoubleQuote ||
			expectedCode === CharCodes.SingleQuote
		) {
			this._consumeQuote(expectedCode);
			this._consumeWithInterpolation(
				SyntaxTokenType.ATTR_VALUE_TEXT,
				SyntaxTokenType.ATTR_VALUE_INTERPOLATION,
				() => this.cursor.peek() === expectedCode,
				() => this.cursor.peek() === expectedCode
			);
			this._consumeQuote(expectedCode);
		} else {
			this._consumeWithInterpolation(
				SyntaxTokenType.ATTR_VALUE_TEXT,
				SyntaxTokenType.ATTR_VALUE_INTERPOLATION,
				() => isNameEnd(this.cursor.peek()),
				() => isNameEnd(this.cursor.peek())
			);
		}
	}

	private _consumeQuote(code: number) {
		this._beginToken(SyntaxTokenType.ATTR_QUOTE);
		this._matchingCharCode(code);
		this._endToken([String.fromCharCode(code)]);
	}

	private _consumeName() {
		const location = this.cursor.clone();
		this._matchingCharCodeUntilFn(isNameEnd, 1);
		const name = this.cursor.getSection(location);
		return name;
	}

	private _consumeTagOpenStart(start: Cursor): string {
		this._beginToken(SyntaxTokenType.TAG_OPEN_START, start);
		const tagName = this._consumeName();
		this._endToken([tagName]);
		return tagName;
	}

	private _consumeTagClose(start: Cursor) {
		this._beginToken(SyntaxTokenType.TAG_CLOSE, start);
		const tagName = this._consumeName();
		this._matchingCharCode(CharCodes.GreaterToken);
		this._endToken([tagName]);
	}

	private _consumeWithInterpolation(
		textToken: SyntaxTokenType,
		interpolationToken: SyntaxTokenType,
		endMarkerWithText: () => boolean,
		endMarkerWithInterpolation: () => boolean
	) {
		this._beginToken(textToken);
		let parts: string[] = [];
		const [interpolationTokenStart] = this.options.interpolationConf;
		while (!endMarkerWithText()) {
			const current = this.cursor.clone();
			if (this._attemptStr(interpolationTokenStart)) {
				this._endToken(
					[this._processCarriageReturns(parts.join(""))],
					current
				);
				parts = [];
				this._consumeInterpolation(
					interpolationToken,
					current,
					endMarkerWithInterpolation
				);
				this._beginToken(textToken);
			} else {
				parts.push(this._readChar());
			}
		}
		this._endToken([this._processCarriageReturns(parts.join(""))]);
	}

	private _consumeInterpolation(
		interpolationToken: SyntaxTokenType,
		interpolationStart: Cursor,
		endMarkerWithInterpolation: (() => boolean) | null = null
	) {
		this._beginToken(interpolationToken, interpolationStart);

		const [interpolationTokenStart, interpolationTokenEnd] =
			this.options.interpolationConf;

		const parts: string[] = [interpolationTokenStart];

		const expressionStart = this.cursor.clone();

		while (
			this.cursor.peek() !== CharCodes.EOF &&
			(endMarkerWithInterpolation === null ||
				!endMarkerWithInterpolation())
		) {
			const current = this.cursor.clone();

			if (this._isTagStart()) {
				this.cursor = current;
				parts.push(this._getProcessedChars(expressionStart, current));
				this._endToken(parts);
				return;
			}

			if (this._attemptStr(interpolationTokenEnd)) {
				parts.push(this._getProcessedChars(expressionStart, current));
				parts.push(interpolationTokenEnd);
				this._endToken(parts);
				return;
			}

			this.cursor.advance();
		}

		parts.push(
			this._getProcessedChars(expressionStart, this.cursor.clone())
		);

		this._endToken(parts);
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

	private _beginToken(
		syntaxToken: SyntaxTokenType,
		start: Cursor = this.cursor.clone()
	) {
		this._currentTokenType = syntaxToken;
		this._currentTokenStart = start;
	}

	private _endToken(parts: string[], end?: Cursor) {
		if (
			this._currentTokenStart === null ||
			this._currentTokenType === null
		) {
			throw new Error(
				`Unexpected error : private property _currentTokenStart ` +
					`or _currentTokenType is null`
			);
		}

		const token = this._createToken(
			new Token(
				this._currentTokenType,
				parts,
				(end ?? this.cursor).getTextSpan(this._currentTokenStart)
			)
		);

		this._currentTokenStart = this._currentTokenType = null;
		return token;
	}

	private _createToken(token: Token) {
		this.tokens.push(token);
		return token;
	}
}
