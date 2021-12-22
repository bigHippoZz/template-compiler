import { CharCodes } from './CharCodes';
import { Cursor } from './Cursor';
import { ParseError, ParseSourceSpan, ParseSourceFile } from './ParseSourceFile';

export namespace Lexer {
	export class LexerTokenError extends ParseError {
		constructor(errorMsg: string, public tokenType: TokenType | null, span: ParseSourceSpan) {
			super(span, errorMsg);
		}
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
		ATTR_VALUE_INTERPOLATION,

		COMMENT_START,
		COMMENT_END,

		CODE_DATA_START,
		CODE_DATA_END,

		DOC_TYPE,

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

		private _cursor: Cursor;
		private _currentTokenType: TokenType | null = null;
		private _currentTokenStart: Cursor | null = null;
		constructor(file: ParseSourceFile) {
			this._cursor = new Cursor(file);
		}

		public lex() {
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
						this._consumeTagOpenEnd(start);
					} else {
						// <div
						this._consumeTagOpenStart(start);
					}
				} else {
				}
			}
		}

		private _consumeCDATA(start: Cursor) {
			this._beginToken(TokenType.CODE_DATA_START, start);
			this._expectStr('CDATA[');
			this._endToken();

			this._consumeRawText(() => this._attemptStr(']]>'));

			this._beginToken(TokenType.CODE_DATA_END);
			this._expectStr(']]>');
			this._endToken();
		}

		private _consumeComment(start: Cursor) {
			this._beginToken(TokenType.COMMENT_START, start);
			this._expectStr('-');
			this._endToken();

			this._consumeRawText(() => this._attemptStr('-->'));

			this._beginToken(TokenType.COMMENT_END);
			this._expectStr('-->');
			this._endToken();
		}

		private _consumeDocType(start: Cursor) {
			this._beginToken(TokenType.DOC_TYPE, start);
			const startLocation = this._cursor.clone();
			this.expectUntilCharCode(CharCodes.GreaterToken);
			const content = this._cursor.getChar(startLocation);
			this._cursor.advance();
			this._endToken([content]);
		}

		private _consumeTagOpenStart(start: Cursor) {
			this._beginToken(TokenType.TAG_OPEN_START, start);
		}

		private _consumeTagOpenEnd(start: Cursor) {}

		private _beginToken(tokenType: TokenType, start = this._cursor.clone()) {
			this._currentTokenType = tokenType;
			this._currentTokenStart = start;
		}

		private _endToken(parts: string[] = [], end?: Cursor) {
			if (!this._currentTokenStart || !this._currentTokenType) {
				throw new Error('Unexpected Error');
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

			this._endToken([this._processCarriageReturn(parts.join(''))]);
		}

		private _attemptCharCode(code: CharCodes): boolean {
			if (this._cursor.peek() === code) {
				this._cursor.advance();
				return true;
			}
			return false;
		}

		private _attemptUntilCharCode(code: CharCodes) {
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

		private expectUntilCharCode(code: CharCodes) {
			const start = this._cursor.clone();
			if (this._attemptUntilCharCode(code)) return;
			throw this._reportError(
				this._createUnexpectedCharacterMessage(),
				this._cursor.getSpan(start),
			);
		}

		private _reportError(message: string, span: ParseSourceSpan) {
			const tokenError = new LexerTokenError(message, this._currentTokenType, span);
			this._resetState();
			return tokenError;
		}

		private _resetState() {
			this._currentTokenStart = this._currentTokenType = null;
		}

		private _processCarriageReturn(str: string): string {
			return str.replace(/\r\n?/g, '\n');
		}

		private _readChar(): string {
			const char = String.fromCharCode(this._cursor.peek());
			this._cursor.advance();
			return char;
		}

		private _createUnexpectedCharacterMessage() {
			return `Unexpected Character "${
				this._cursor.peek() === CharCodes.EOF
					? 'EOF'
					: String.fromCharCode(this._cursor.peek())
			}"`;
		}
	}

	export function tokenize(source: string): TokenizeResult {
		const tokenizer = new Tokenize(new ParseSourceFile(source));
		tokenizer.lex();
		return new TokenizeResult(tokenizer.tokens, []);
	}
}
