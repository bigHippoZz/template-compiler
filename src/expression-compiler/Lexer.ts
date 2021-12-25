import {
	CharCodes,
	isWhitespace,
	isDigit,
	isIdentifierStart,
	isIdentifierPart,
	isExponentSign,
} from "../html-compiler/CharCodes";
import { ExpressionAST } from "./AST";

export namespace ExpressionLexer {
	export enum SyntaxTokenKind {
		Character,
		Identifier,
		Keyword,
		String,
		Number,
		Operator,
		Error,
	}

	export const KEYWORDS = ["this", "true", "false", "undefined", "null"] as const;

	export class Lexer {
		public tokenize(input: string) {
			const scanner = new _Scanner(input);
			const tokens = [];
			let token = scanner.scanToken();
			while (token !== null) {
				tokens.push(token);
				token = scanner.scanToken();
			}
			return tokens;
		}
	}

	export class _Scanner {
		public rootNodes: ExpressionAST.Node[] = [];

		private _index: number = -1;

		constructor(private _input: string) {
			this._advance();
		}

		private get _current() {
			return !this._shouldStop() ? CharCodes.EOF : this._input.charCodeAt(this._index);
		}

		public scanToken(): SyntaxToken | null {
			// skip whitespace
			while (true) {
				if (isWhitespace(this._current)) {
					this._advance();
				} else if (!this._shouldStop()) {
					return null;
				} else {
					break;
				}
			}

			// handle identifiers
			if (isIdentifierStart(this._current)) return this._scanIdentifier();

			// handle number
			if (isDigit(this._current)) return this._scanNumber();

			switch (this._current) {
				case CharCodes.Period /* . */:
					const start = this._index;
					this._advance();
					return isDigit(this._current)
						? this._scanNumber(start)
						: createCharacterToken(start, this._index, CharCodes.Period);

				case CharCodes.Lparen: /* (*/
				case CharCodes.Rparen: /* ) */
				case CharCodes.Lbracket: /* [ */
				case CharCodes.Rbracket: /* ] */
				case CharCodes.Lbrace: /* { */
				case CharCodes.Rbrace: /* } */
				case CharCodes.Colon: /* : */
				case CharCodes.Comma: /* , */
				case CharCodes.Semicolon /* ; */:
					return this._scanCharacter();

				case CharCodes.DoubleQuote: /* " */
				case CharCodes.SingleQuote /* ' */:
					return this._scanString();

				case CharCodes.Minus: /* + */
				case CharCodes.Plus: /* - */
				case CharCodes.Star: /* * */
				case CharCodes.Slash: /* / */
				case CharCodes.Percent: /* % */
				case CharCodes.Caret /* ^ */:
					return this._scanOperator();

				case CharCodes.EqualToken: /* = */
				case CharCodes.ExclamationMark /* ! */:
					return this._scanCompareOperator(
						"=",
						CharCodes.EqualToken,
						"=",
						CharCodes.EqualToken,
					);

				case CharCodes.Bar /* | */:
					return this._scanCompareOperator("|", CharCodes.Bar);

				case CharCodes.Ampersand /* & */:
					return this._scanCompareOperator("&", CharCodes.Ampersand);

				case CharCodes.LowerToken: /* < */
				case CharCodes.GreaterToken /* > */:
					return this._scanCompareOperator("=", CharCodes.EqualToken);

				case CharCodes.QuestionMark /* ? */:
					return this._scanQuestion();
				case CharCodes.Nbsp:
					while (isWhitespace(this._current)) this._advance();
					return this.scanToken();

				default:
					const code = this._advance();
					return createErrorToken(
						this._index - 1,
						this._index,
						`Unexpected Character [${String.fromCharCode(code)}]`,
					);
			}
		}

		private _scanCharacter() {
			const code = this._advance();
			return createCharacterToken(this._index - 1, this._index, code);
		}

		private _scanOperator() {
			const charCode = this._advance();
			return createOperatorToken(this._index - 1, this._index, String.fromCharCode(charCode));
		}

		private _scanQuestion() {
			// ?? ?. condition ?  expr : expr
			const start = this._index;
			this._advance();
			if (this._current === CharCodes.QuestionMark || this._current === CharCodes.Period) {
				this._advance();
				return createOperatorToken(
					start,
					this._index,
					this._current === CharCodes.QuestionMark ? "??" : "?.",
				);
			}
			return createOperatorToken(start, this._index, "?");
		}

		private _scanIdentifier() {
			const start = this._index;
			this._advance();
			while (isIdentifierPart(this._current)) this._advance();
			const identifier = this._input.substring(start, this._index);
			const createFn =
				KEYWORDS.indexOf(identifier as typeof KEYWORDS[number]) > -1
					? createKeywordToken
					: createIdentifierToken;
			return createFn(start, this._index, identifier as any);
		}

		private _scanString() {
			// ""  ''
			// \'
			const start = this._index;
			const quote = this._current;
			this._advance();

			let buffer = "";

			let marker = this._index;

			while (this._current !== quote) {
				if (this._current === CharCodes.Backslash) {
					buffer += this._input.substring(marker, this._index);
					this._advance();
					let unescapedCode: number;
					// @ts-ignore
					if (this._current === CharCodes.LowerU) {
						const hex: string = this._input.substring(this._index + 1, this._index + 5);
						if (/^[0-9a-f]+$/i.test(hex)) {
							unescapedCode = parseInt(hex, 16);
						} else {
							return createErrorToken(0, 0, `Invalid unicode escape [\\u${hex}]`);
						}
						for (let i: number = 0; i < 5; i++) {
							this._advance();
						}
					} else {
						unescapedCode = unescape(this._current);
						this._advance();
					}
					buffer += String.fromCharCode(unescapedCode);
					marker = this._index;
				} else if (this._current === CharCodes.EOF) {
					return createErrorToken(this._index - 1, this._index, "Unterminated quote");
				} else {
					this._advance();
				}
			}
			const last = this._input.substring(marker, this._index);
			this._advance();
			return createStringToken(start, this._index, buffer + last);
		}

		private _scanNumber(start?: number) {
			// 100_1000_199
			// 289e-1
			// 0.1
			start = start ?? this._index;
			let hasUnderline = false;
			let simple = start === void 0;
			this._advance();
			while (true) {
				if (isDigit(this._current)) {
					// ignore
				} else if (this._current === CharCodes.Underscore) {
					if (
						!isDigit(this._input.charCodeAt(this._index - 1)) ||
						!isDigit(this._input.charCodeAt(this._index + 1))
					) {
						return createErrorToken(start, this._index, "Invalid numeric separator");
					}
					hasUnderline = true;
				} else if (
					this._current === CharCodes.LowerE ||
					this._current === CharCodes.UpperE
				) {
					this._advance();
					if (isExponentSign(this._current)) this._advance();
					if (!isDigit(this._current))
						return createErrorToken(this._index - 1, this._index, "Invalid exponent");
					simple = false;
				} else if (this._current === CharCodes.Period) {
					simple = false;
				} else {
					break;
				}
				this._advance();
			}

			let numberStr: string = this._input.substring(start, this._index);

			// clean underline
			hasUnderline && (numberStr = numberStr.replace(/_/g, ""));

			// parse number
			const value = simple ? parseInt(numberStr, 10) : parseFloat(numberStr);

			//valid
			if (isNaN(value)) {
				throw new Error("Invalid integer literal when parsing " + numberStr);
			}

			return createNumberToken(start, this._index, value);
		}

		private _scanCompareOperator(
			attempt1: string,
			attempt1Code: number,
			attempt2?: string,
			attempt2Code?: number,
		) {
			const start = this._index;
			const currentCharCode = this._advance();
			let value = String.fromCharCode(currentCharCode);

			if (this._current === attempt1Code) {
				value += attempt1;
				this._advance();
				if (attempt2Code && this._current === attempt2Code) {
					value += attempt2;
					this._advance();
				}
			}

			return createOperatorToken(start, this._index, value);
		}

		private _shouldStop() {
			return this._index < this._input.length;
		}

		private _advance() {
			const prev = this._current;
			if (this._shouldStop()) {
				this._index++;
			}
			return prev;
		}
	}

	export class SyntaxToken {
		constructor(
			public start: number,
			public end: number,
			public type: SyntaxTokenKind,
			public numberValue: number,
			public StringValue: string,
		) {}

		public isCharacter(code: number) {
			return this.type === SyntaxTokenKind.Character && this.numberValue === code;
		}

		public isIdentifier() {
			return this.type === SyntaxTokenKind.Identifier;
		}

		public isKeyword() {
			return this.type === SyntaxTokenKind.Keyword;
		}
		public isKeywordThis() {
			return this.isKeyword() && this.StringValue === "this";
		}
		public isKeywordTrue() {
			return this.isKeyword() && this.StringValue === "true";
		}
		public isKeywordFalse() {
			return this.isKeyword() && this.StringValue === "false";
		}
		public isKeywordNull() {
			return this.isKeyword() && this.StringValue === "null";
		}
		public isKeywordUndefined() {
			return this.isKeyword() && this.StringValue === "undefined";
		}

		public isString() {
			return this.type === SyntaxTokenKind.String;
		}

		public isNumber() {
			return this.type === SyntaxTokenKind.Number;
		}

		public isOperator(operator: string) {
			return this.type === SyntaxTokenKind.Operator && this.StringValue === operator;
		}

		public isError() {
			return this.type === SyntaxTokenKind.Error;
		}
	}

	export function createCharacterToken(start: number, end: number, code: number) {
		return new SyntaxToken(
			start,
			end,
			SyntaxTokenKind.Character,
			code,
			String.fromCharCode(code),
		);
	}

	export function createIdentifierToken(start: number, end: number, value: string) {
		return new SyntaxToken(start, end, SyntaxTokenKind.Identifier, 0, value);
	}

	export function createKeywordToken(start: number, end: number, value: typeof KEYWORDS[number]) {
		return new SyntaxToken(start, end, SyntaxTokenKind.Keyword, 0, value);
	}

	export function createStringToken(start: number, end: number, value: string) {
		return new SyntaxToken(start, end, SyntaxTokenKind.String, 0, value);
	}

	export function createNumberToken(start: number, end: number, value: number) {
		return new SyntaxToken(start, end, SyntaxTokenKind.Number, value, "");
	}

	export function createOperatorToken(start: number, end: number, value: string) {
		return new SyntaxToken(start, end, SyntaxTokenKind.Operator, 0, value);
	}

	export function createErrorToken(start: number, end: number, message: string) {
		return new SyntaxToken(start, end, SyntaxTokenKind.Error, 0, message);
	}

	export function unescape(code: number): number {
		switch (code) {
			case CharCodes.LowerN:
				return CharCodes.NewLine;
			case CharCodes.LowerF:
				return CharCodes.FormFeed;
			case CharCodes.LowerR:
				return CharCodes.CarriageReturn;
			case CharCodes.LowerT:
				return CharCodes.Tab;
			case CharCodes.LowerV:
				return CharCodes.Vtab;
			default:
				return code;
		}
	}
}
