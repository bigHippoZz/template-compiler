import { CharCodes, isAsciiLetter, isNameEnd, isNotWhitespace, isQuote } from "./CharCodes";
import { Cursor } from "./Cursor";
import { ParseError, ParseSourceSpan, ParseSourceFile } from "./ParseSourceFile";
import { DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig } from "./InterpolationConfig";
import { getHtmlTagDefinition, TagContentType, TagDefinition } from "./HtmlTags";

export namespace Lexer {
	export class LexerTokenError extends ParseError {
		constructor(errorMsg: string, public tokenType: TokenType | null, span: ParseSourceSpan) {
			super(span, errorMsg);
		}
	}

	export class _ControlFlowError {
		constructor(public tokenError: LexerTokenError) {}
	}

	export enum TokenType {
		RAW_TEXT = 1,
		TEXT,

		TAG_OPEN_START,
		TAG_OPEN_END,
		TAG_OPEN_VOID,
		TAG_CLOSE,

		INCOMPLETE_TAG_OPEN,

		ATTR_NAME,
		ATTR_QUOTE,
		ATTR_VALUE_TEXT,

		COMMENT_START,
		COMMENT_END,

		CODE_DATA_START,
		CODE_DATA_END,

		DOC_TYPE,

		INTERPOLATION,

		EOF,
	}

	export class Token {
		constructor(
			public type: TokenType,
			public parts: string[],
			public sourceSpan: ParseSourceSpan,
		) {}
	}

	export class TokenizeResult {
		constructor(public tokens: Token[], public tokenErrors: LexerTokenError[]) {}
	}

	export class Tokenize {
		public tokens: Token[] = [];
		public errors: LexerTokenError[] = [];

		private _cursor: Cursor;
		private _currentTokenType: TokenType | null = null;
		private _currentTokenStart: Cursor | null = null;

		constructor(
			file: ParseSourceFile,
			private _getTagDefinition: (tagName: string) => TagDefinition,
			private _interpolationConfig: InterpolationConfig,
		) {
			this._cursor = new Cursor(file);
		}

		public lex() {
			try {
				while (this._cursor.shouldStop()) {
					const start = this._cursor.clone();
					if (this._attemptCharCode(CharCodes.LowerToken)) {
						if (this._attemptCharCode(CharCodes.ExclamationMark)) {
							if (this._attemptCharCode(CharCodes.Minus)) {
								// <!-- COMMENT -->
								this._consumeComment(start);
							} else if (this._attemptCharCode(CharCodes.Lbracket)) {
								// <![CDATA[some stuff]]>
								this._consumeCDATA(start);
							} else {
								// <!DOCTYPE html>
								this._consumeDocType(start);
							}
						} else if (this._attemptCharCode(CharCodes.Slash)) {
							// </div
							this._consumeTagClose(start);
						} else {
							// <div
							this._consumeTagOpen(start);
						}
					} else {
						this._consumeWithInterpolation(
							TokenType.TEXT,
							TokenType.INTERPOLATION,
							() => this._isTextEnd(),
							() => this._isTagStart(),
						);
					}
				}
			} catch (error) {
				this._handleError(error);
			}

			this._beginToken(TokenType.EOF);
			this._endToken();
		}

		private _consumeCDATA(start: Cursor) {
			this._beginToken(TokenType.CODE_DATA_START, start);
			this._expectStr("CDATA[");
			this._endToken();

			this._consumeRawText(() => this._attemptStr("]]>"));

			this._beginToken(TokenType.CODE_DATA_END);
			this._expectStr("]]>");
			this._endToken();
		}

		private _consumeComment(start: Cursor) {
			this._beginToken(TokenType.COMMENT_START, start);
			this._expectStr("-");
			this._endToken();

			this._consumeRawText(() => this._attemptStr("-->"));

			this._beginToken(TokenType.COMMENT_END);
			this._expectStr("-->");
			this._endToken();
		}

		private _consumeDocType(start: Cursor) {
			this._beginToken(TokenType.DOC_TYPE, start);
			const startLocation = this._cursor.clone();
			this.expectCharCodeUntil(CharCodes.GreaterToken);
			const content = this._cursor.getChar(startLocation);
			this._cursor.advance();
			this._endToken([content]);
		}

		private _consumeTagOpen(start: Cursor) {
			let tagOpenToken: Token | null = null;
			let tagName: string | null = null;
			try {
				if (!isAsciiLetter(this._cursor.peek())) {
					throw this._reportError(
						this._createUnexpectedCharacterMessage(),
						this._cursor.getSpan(start),
					);
				}

				tagOpenToken = this._consumeTagOpenStart(start);
				tagName = tagOpenToken.parts[0];

				let current = this._cursor.peek();

				while (
					current !== CharCodes.GreaterToken &&
					current !== CharCodes.Slash &&
					current !== CharCodes.EOF
				) {
					// skip whitespace
					this._attemptCharCodeUntilFn(isNotWhitespace);

					this._consumeAttributeName();
					if (this._attemptCharCode(CharCodes.EqualToken)) {
						this._consumeAttributeValue();
					}
					current = this._cursor.peek();
				}

				// skip whitespace
				this._attemptCharCodeUntilFn(isNotWhitespace);

				this._consumeTagOpenEnd(tagName);
			} catch (error) {
				if (error instanceof _ControlFlowError) {
					if (tagOpenToken) {
						tagOpenToken.type = TokenType.INCOMPLETE_TAG_OPEN;
					} else {
						this._beginToken(TokenType.TEXT, start);
						this._endToken(["<"]);
					}
					return;
				}

				throw error;
			}

			// skip script style
			if (this._getTagDefinition(tagName).getContentType() === TagContentType.RAW_TEXT) {
				this._consumeRawTextWithTagClose(tagName);
			}
		}

		private _consumeTagClose(start: Cursor) {
			this._beginToken(TokenType.TAG_CLOSE);
			if (!isAsciiLetter(this._cursor.peek())) {
				throw this._reportError(
					this._createUnexpectedCharacterMessage(),
					this._cursor.getSpan(start),
				);
			}
			const tagName = this._consumeName();

			this._expectCharCode(CharCodes.GreaterToken);

			this._endToken([tagName]);
		}

		private _consumeWithInterpolation(
			textTokenType: TokenType,
			InterpolationTokenType: TokenType,
			endMarker: () => boolean,
			endInterpolationMarker: () => boolean,
		) {
			let parts: string[] = [];

			this._beginToken(textTokenType);

			while (!endMarker() && this._cursor.peek() !== CharCodes.EOF) {
				const current = this._cursor.clone();

				if (this._attemptStr(this._interpolationConfig.start)) {
					this._endToken([this._processCarriageReturn(parts.join(""))], current);
					parts = [];
					this._consumeInterpolation(
						InterpolationTokenType,
						current,
						endInterpolationMarker,
					);
					this._beginToken(textTokenType);
				} else {
					parts.push(this._readChar());
				}
			}

			this._endToken([this._processCarriageReturn(parts.join(""))]);
		}

		private _consumeRawTextWithTagClose(tagName: string) {
			this._consumeRawText(() => {
				if (!this._attemptCharCode(CharCodes.LowerToken)) return false;
				if (!this._attemptCharCode(CharCodes.Slash)) return false;
				this._attemptCharCodeUntilFn(isNotWhitespace);
				if (!this._attemptStr(tagName)) return false;
				this._attemptCharCodeUntilFn(isNotWhitespace);
				return this._attemptCharCode(CharCodes.GreaterToken);
			});
			this._beginToken(TokenType.TAG_CLOSE);
			this._expectCharCodeUntilFn((code) => code === CharCodes.GreaterToken, 5 /* style */);
			this._cursor.advance();
			this._endToken([tagName]);
		}

		private _consumeTagOpenEnd(tagName: string) {
			const start = this._cursor.clone();
			const tokenType = this._attemptCharCode(CharCodes.Slash)
				? TokenType.TAG_OPEN_VOID
				: TokenType.TAG_OPEN_END;
			this._beginToken(tokenType, start);
			this._expectCharCode(CharCodes.GreaterToken);
			this._endToken([tagName]);
		}

		private _consumeAttributeName() {
			this._beginToken(TokenType.ATTR_NAME);
			const name = this._consumeName();
			return this._endToken([name]);
		}

		private _consumeAttributeValue() {
			// valid char
			const currentCharCode = this._cursor.peek();

			if (
				currentCharCode !== CharCodes.SingleQuote &&
				currentCharCode !== CharCodes.DoubleQuote
			) {
				throw this._reportError(
					this._createUnexpectedCharacterMessage(),
					this._cursor.getSpan(),
				);
			}

			this._consumeQuote(currentCharCode);

			const startLocation = this._cursor.clone();
			this._beginToken(TokenType.ATTR_VALUE_TEXT, startLocation);
			this._expectCharCodeUntilFn((code) => code === currentCharCode);

			const value = this._cursor.getChar(startLocation).trim();
			value.length ? this._endToken([value]) : this._resetState();

			this._consumeQuote(currentCharCode);
		}

		private _consumeInterpolation(
			interpolationTokenType: TokenType,
			interpolationStart: Cursor,
			endMarker: () => boolean,
		) {
			this._beginToken(interpolationTokenType, interpolationStart);

			const [startInterpolation, endInterpolation] = this._interpolationConfig.from();

			let inQuote: number | null = null;

			let inQuoteLocation: Cursor | null = null;

			let inComment = false;

			const parts: string[] = [startInterpolation];

			const expressionStart = this._cursor.clone();

			while (this._cursor.peek() !== CharCodes.EOF && !endMarker()) {
				const current = this._cursor.clone();

				if (this._isTagStart()) {
					parts.push(this._processCarriageReturn(current.getChar(expressionStart)));
					this._cursor = current;
					this._endToken(parts, current);
					return;
				}

				if (inQuote === null) {
					if (this._attemptStr(endInterpolation)) {
						parts.push(this._processCarriageReturn(current.getChar(expressionStart)));
						parts.push(endInterpolation);
						this._endToken(parts);
						return;
					} else if (this._attemptStr("//")) {
						inComment = true;
					}
				}

				const charCode = this._cursor.peek();
				if (!inComment && inQuote === null && isQuote(charCode)) {
					inQuote = charCode;
					inQuoteLocation = this._cursor.clone();
				} else if (inComment && charCode === inQuote) {
					inQuote = inQuoteLocation = null;
				} else if (charCode === CharCodes.Backslash) {
					this._cursor.advance();
				}

				this._cursor.advance();
			}

			if (inQuoteLocation) {
				throw this._reportError(
					this._createUnexpectedCharacterMessage(),
					inQuoteLocation?.getSpan(),
				);
			}

			parts.push(this._processCarriageReturn(this._cursor.getChar(expressionStart)));

			this._endToken(parts);
		}

		private _isTextEnd() {
			return this._isTagStart() || this._cursor.peek() === CharCodes.EOF;
		}

		private _isTagStart() {
			if (this._cursor.peek() === CharCodes.LowerToken) {
				const current = this._cursor.clone();
				current.advance();
				if (
					isAsciiLetter(current.peek()) ||
					current.peek() === CharCodes.ExclamationMark ||
					CharCodes.Slash
				) {
					return true;
				}
			}
			return false;
		}

		private _consumeQuote(quote: CharCodes.SingleQuote | CharCodes.DoubleQuote) {
			this._beginToken(TokenType.ATTR_QUOTE);
			this._expectCharCode(quote);
			this._endToken([quote === CharCodes.SingleQuote ? `'` : `"`]);
		}

		private _consumeTagOpenStart(start: Cursor) {
			this._beginToken(TokenType.TAG_OPEN_START, start);
			const name = this._consumeName();
			return this._endToken([name]);
		}

		private _consumeName() {
			const start = this._cursor.clone();
			this._expectCharCodeUntilFn(isNameEnd, 1);
			return this._cursor.getChar(start);
		}

		private _expectCharCodeUntilFn(endMarkerFn: (code: number) => boolean, offset: number = 0) {
			const start = this._cursor.clone();
			this._attemptCharCodeUntilFn(endMarkerFn);
			if (this._cursor.diff(start) < offset) {
				throw this._reportError(
					this._createUnexpectedCharacterMessage(),
					this._cursor.getSpan(start),
				);
			}
		}

		private _attemptCharCodeUntilFn(endMarkerFn: (code: number) => boolean) {
			while (!endMarkerFn(this._cursor.peek())) {
				this._cursor.advance();
			}
		}

		private _beginToken(tokenType: TokenType, start = this._cursor.clone()) {
			this._currentTokenType = tokenType;
			this._currentTokenStart = start;
		}

		private _endToken(parts: string[] = [], end?: Cursor) {
			if (!this._currentTokenStart || !this._currentTokenType) {
				throw new Error("Unexpected Error");
			}

			const token = new Token(
				this._currentTokenType,
				parts,
				(end ?? this._cursor).getSpan(this._currentTokenStart),
			);

			this.tokens.push(token);

			this._resetState();

			return token;
		}

		private _consumeRawText(endMarker: () => boolean) {
			// TODO
			this._beginToken(TokenType.RAW_TEXT);
			const parts: string[] = [];
			while (true) {
				const currentCursor = this._cursor.clone();
				if (endMarker()) {
					this._cursor = currentCursor;
					break;
				}
				parts.push(this._readChar());
			}

			this._endToken([this._processCarriageReturn(parts.join(""))]);
		}

		private _attemptCharCode(code: CharCodes): boolean {
			if (this._cursor.peek() === code) {
				this._cursor.advance();
				return true;
			}
			return false;
		}

		private _attemptCharCodeUntil(code: CharCodes) {
			if (!this._cursor.foresight(code)) return false;
			while (this._cursor.peek() !== code) {
				this._cursor.advance();
			}
			return true;
		}

		private _attemptStr(str: string): boolean {
			if (this._cursor.startWith(str)) {
				for (let i = 0; i < str.length; i++) {
					this._cursor.advance();
				}
				return true;
			}
			return false;
		}

		private _expectStr(str: string) {
			const start = this._cursor.clone();
			if (this._attemptStr(str)) return;
			throw this._reportError(
				this._createUnexpectedCharacterMessage(),
				this._cursor.getSpan(start),
			);
		}

		private _expectCharCode(code: CharCodes) {
			const start = this._cursor.clone();
			if (this._attemptCharCode(code)) return;
			throw this._reportError(
				this._createUnexpectedCharacterMessage(),
				this._cursor.getSpan(start),
			);
		}

		private expectCharCodeUntil(code: CharCodes) {
			const start = this._cursor.clone();
			if (this._attemptCharCodeUntil(code)) return;
			throw this._reportError(
				this._createUnexpectedCharacterMessage(),
				this._cursor.getSpan(start),
			);
		}

		private _reportError(message: string, span: ParseSourceSpan) {
			const tokenError = new LexerTokenError(message, this._currentTokenType, span);

			this._resetState();

			return new _ControlFlowError(tokenError);
		}

		private _resetState() {
			this._currentTokenStart = this._currentTokenType = null;
		}

		private _processCarriageReturn(str: string): string {
			return str.replace(/\r\n?/g, "\n");
		}

		private _readChar(): string {
			const char = String.fromCharCode(this._cursor.peek());
			this._cursor.advance();
			return char;
		}

		private _createUnexpectedCharacterMessage() {
			return `Unexpected Character "${
				this._cursor.peek() === CharCodes.EOF
					? "EOF"
					: String.fromCharCode(this._cursor.peek())
			}"`;
		}

		private _handleError(error: unknown) {
			if (error instanceof _ControlFlowError) {
				this.errors.push(error.tokenError);
			} else throw error;
		}
	}

	export function tokenize(source: string): TokenizeResult {
		const tokenizer = new Tokenize(
			new ParseSourceFile(source),
			getHtmlTagDefinition,
			DEFAULT_INTERPOLATION_CONFIG,
		);

		tokenizer.lex();

		return new TokenizeResult(mergeTextToken(tokenizer.tokens), tokenizer.errors);
	}

	export function mergeTextToken(tokens: Token[]) {
		const result: Token[] = [];
		let currentTextToken: Token | null = null;

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (
				(currentTextToken &&
					token.type === TokenType.TEXT &&
					currentTextToken.type === TokenType.TEXT) ||
				(currentTextToken &&
					token.type === TokenType.ATTR_VALUE_TEXT &&
					currentTextToken.type === TokenType.ATTR_VALUE_TEXT)
			) {
				currentTextToken.parts[0] += token.parts[0];
				currentTextToken.sourceSpan.end = token.sourceSpan.end;
			} else {
				currentTextToken = token;
				result.push(currentTextToken);
			}
		}

		return result;
	}
}
