import { CharCodes, isAsciiLetter, isDigit } from "src/CharCodes";

const KEYWORDS = ["null", "undefined", "true", "false", "this"] as const;

export class Lexer {
	constructor(public input: string) {}
	public tokenize() {
		const scanner = new Scanner(this.input);
		const tokens: Token[] = [];
		let token = scanner.scanToken();
		while (token !== null) {
			tokens.push(token);
			token = scanner.scanToken();
		}
		return tokens;
	}
}

export class Scanner {
	public length: number;
	public index!: number;
	public peek!: number;
	public diagnostic: Array<string> = [];

	constructor(public input: string) {
		this.length = input.length;
		this.advance();
	}

	public advance() {
		this.peek =
			++this.index >= this.input.length ? CharCodes.EOF : this.input.charCodeAt(this.index);
	}

	public scanToken(): Token | null {
		const input = this.input,
			length = this.length;

		let peek = this.peek,
			index = this.index;

		// skip whitespace
		while (peek <= CharCodes.Space) {
			if (++index >= length) {
				peek = CharCodes.EOF;
			} else {
				peek = input.charCodeAt(index);
			}
		}

		this.index = index;
		this.peek = peek;

		if (index >= length) {
			return null;
		}

		if (isIdentifierStart(this.peek)) return this.scanIdentifier();

		if (isDigit(this.peek)) return this.scanNumber(index);

		let start: number = index;

		switch (peek) {
			case CharCodes.Period:
				this.advance();
				return isDigit(this.peek)
					? this.scanNumber(start)
					: createNumberToken(start, this.index, CharCodes.Period);
			case CharCodes.LPAREN:
			case CharCodes.RPAREN:
			case CharCodes.LBRACE:
			case CharCodes.RBRACE:
			case CharCodes.LBRACKET:
			case CharCodes.RBRACKET:
			case CharCodes.COMMA:
			case CharCodes.COLON:
			case CharCodes.SEMICOLON:
				return this.scanCharacter(start, peek);

			case CharCodes.DoubleQuote:
			case CharCodes.SingleQuote:
				return this.scanString();

			case CharCodes.HASH:
				return this.scanPrivateIdentifier();

			case CharCodes.Plus:
			case CharCodes.Minus:
			case CharCodes.Star:
			case CharCodes.Slash:
			case CharCodes.Percent:
			case CharCodes.Caret:
				return this.scanOperator(start, String.fromCharCode(peek));

			case CharCodes.QuestionMark:
				return this.scanQuestion(start);

			case CharCodes.LowerToken:
			case CharCodes.GreaterToken:
				return this.scanCompleteOperator(
					start,
					String.fromCharCode(peek),
					CharCodes.EqualToken,
					"=",
				);

			case CharCodes.ExclamationMark:
			case CharCodes.EqualToken:
				return this.scanCompleteOperator(
					start,
					String.fromCharCode(peek),
					CharCodes.EqualToken,
					"=",
					CharCodes.EqualToken,
					"=",
				);

			case CharCodes.Ampersand:
				return this.scanCompleteOperator(start, "&", CharCodes.Ampersand, "&");

			case CharCodes.Bar:
				return this.scanCompleteOperator(start, "|", CharCodes.Bar, "|");

			case CharCodes.Nbsp:
				while (this.peek === CharCodes.Space) this.advance();
				return this.scanToken();
		}
		this.advance();
		return this.error(`Unexpected character [${String.fromCharCode(this.peek)}]`, 0);
	}

	public scanCompleteOperator(
		start: number,
		one: string,
		twoCode: number,
		two: string,
		threeCode?: number,
		three?: string,
	): Token {
		this.advance();
		let str: string = one;

		if (this.peek === twoCode) {
			str += two;
			this.advance();
		}

		if (threeCode !== undefined && this.peek === threeCode) {
			str += three;
			this.advance();
		}

		return createOperatorToken(start, this.index, str);
	}

	public scanPrivateIdentifier() {
		let start: number = this.index;
		this.advance();
		if (!isIdentifierStart(this.peek)) {
			this.error("Invalid character [#]", -1);
		}
		while (isIdentifierPart(this.peek)) this.advance();
		const identifierName: string = this.input.slice(start, this.index);
		return createPrivateIdentifierToken(start, this.index, identifierName);
	}

	public scanQuestion(start: number): Token {
		this.advance();
		let str: string = "?";
		if (this.peek === CharCodes.QuestionMark || this.peek === CharCodes.Period) {
			str += this.peek === CharCodes.QuestionMark ? "?" : ".";
			this.advance();
		}
		return createOperatorToken(start, this.index, str);
	}

	public scanOperator(start: number, text: string): Token {
		this.advance();
		return createOperatorToken(start, this.index, text);
	}

	public scanString() {
		const start = this.index;
		const quote = this.peek;
		this.advance();

		let buffer: string = "";
		let marker: number = this.index;
		const input: string = this.input;

		while (this.peek !== quote) {
			if (this.peek === CharCodes.Backslash) {
				buffer += input.slice(marker, this.index);
				this.advance();
				let unescapedCode: number;
				// Workaround for TS2.1-introduced type strictness
				this.peek = this.peek;
				if (this.peek === CharCodes.LowerU) {
					const hex: string = input.slice(this.index + 1, this.index + 5);
					if (/^[0-9a-f]+$/.test(hex)) {
						unescapedCode = parseInt(hex, 16);
					} else {
						return this.error(`Invalid unicode escape [\\u${hex}]`, 0);
					}
					// skip unicode
					for (let i = 0; i < 5; i++) {
						this.advance();
					}
				} else {
					unescapedCode = unescape(this.peek);
					this.advance();
				}

				buffer += String.fromCharCode(unescapedCode);
				marker = this.index;
			} else if (this.peek === CharCodes.EOF) {
				this.diagnostic.push("Unterminated quote");
			} else {
				this.advance();
			}
		}

		const last = this.input.slice(marker, this.index);
		this.advance();
		return createStringToken(start, this.index, buffer + last);
	}
	public scanCharacter(start: number, code: CharCodes) {
		this.advance();
		return createCharacterToken(start, this.index, code);
	}

	public scanNumber(start: number) {
		let simple = start === this.index;
		let hasSeparators = false;
		this.advance();
		while (true) {
			if (isDigit(this.peek)) {
				// ignore
			} else if (this.peek === CharCodes.Underscore) {
				if (
					!isDigit(this.input.charCodeAt(this.index + 1)) ||
					!isDigit(this.input.charCodeAt(this.index - 1))
				) {
					this.error("Invalid numeric separator", 0);
				}
				hasSeparators = true;
			} else if (this.peek === CharCodes.Period) {
				simple = false;
			} else if (isExponentStart(this.peek)) {
				this.advance();
				if (isExponentSign(this.peek)) this.advance();
				if (!isDigit(this.peek)) return this.error("Invalid exponent", -1);
				simple = false;
			} else {
				break;
			}
			this.advance();
		}

		let str: string = this.input.slice(start, this.index);

		if (hasSeparators) {
			str = str.replace(/_/g, "");
		}

		const value = simple ? parseIntAutoRadix(str) : parseFloat(str);

		return createNumberToken(start, this.index, value);
	}

	public scanIdentifier() {
		const start: number = this.index;
		this.advance();
		while (isIdentifierPart(this.peek)) this.advance();
		const keyword = this.input.slice(start, this.index);
		return KEYWORDS.includes(keyword as typeof KEYWORDS[number])
			? createKeywordToken(start, this.index, keyword)
			: createIdentifierToken(start, this.index, keyword);
	}

	public error(sectionMsg: string, offset: number) {
		const position = this.index + offset;
		const message: string = `Lexer Error: ${sectionMsg} at column ${position} in expression [${this.input}]`;
		return createErrorToken(position, this.index, message);
	}
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

export function isIdentifierPart(code: number): boolean {
	return (
		isAsciiLetter(code) ||
		isDigit(code) ||
		code === CharCodes.Underscore ||
		code === CharCodes.Dollar
	);
}

export function isExponentStart(code: number): boolean {
	return code === CharCodes.LowerE || code === CharCodes.UpperE;
}

export function isExponentSign(code: number) {
	return code === CharCodes.Plus || code === CharCodes.Minus;
}

export function isIdentifierStart(code: number): boolean {
	return (
		(code >= CharCodes.LowerA && code <= CharCodes.LowerZ) ||
		(code >= CharCodes.UpperA && code <= CharCodes.UpperZ) ||
		code === CharCodes.Underscore ||
		code === CharCodes.Dollar
	);
}

export function parseIntAutoRadix(str: string) {
	const result: number = parseInt(str);
	if (isNaN(result)) {
		throw new Error("Invalid integer literal when parsing " + str);
	}
	return result;
}

export function createCharacterToken(start: number, end: number, code: CharCodes): Token {
	return new Token(start, end, SyntaxTokenType.Character, code, String.fromCharCode(code));
}

export function createIdentifierToken(start: number, end: number, text: string): Token {
	return new Token(start, end, SyntaxTokenType.Identifier, 0, text);
}

export function createPrivateIdentifierToken(start: number, end: number, text: string): Token {
	return new Token(start, end, SyntaxTokenType.Character, 0, text);
}

export function createKeywordToken(start: number, end: number, keyword: string): Token {
	return new Token(start, end, SyntaxTokenType.Keyword, 0, keyword);
}

export function createStringToken(start: number, end: number, text: string): Token {
	return new Token(start, end, SyntaxTokenType.String, 0, text);
}

export function createOperatorToken(start: number, end: number, text: string): Token {
	return new Token(start, end, SyntaxTokenType.Operator, 0, text);
}

export function createNumberToken(start: number, end: number, code: number): Token {
	return new Token(start, end, SyntaxTokenType.Number, code, "");
}

export function createErrorToken(start: number, end: number, message: string): Token {
	return new Token(start, end, SyntaxTokenType.Error, 0, message);
}

export enum SyntaxTokenType {
	Character,
	Identifier,
	PrivateIdentifier,
	Keyword,
	String,
	Operator,
	Error,
	Number,
}

export class Token {
	constructor(
		public start: number,
		public end: number,
		public type: SyntaxTokenType,
		public numValue: number,
		public strValue: string,
	) {}

	public isCharacter(code: number): boolean {
		return this.type === SyntaxTokenType.Character && code === this.numValue;
	}

	public isNumber(): boolean {
		return this.type === SyntaxTokenType.Number;
	}

	public isString(): boolean {
		return this.type === SyntaxTokenType.String;
	}

	public isIdentifier(): boolean {
		return this.type === SyntaxTokenType.Identifier;
	}

	public isPrivateIdentifier(): boolean {
		return this.type === SyntaxTokenType.PrivateIdentifier;
	}

	public isOperation(operator: string): boolean {
		return this.type === SyntaxTokenType.Operator && this.strValue === operator;
	}

	public isKeyword(): boolean {
		return this.type === SyntaxTokenType.Keyword;
	}

	public isKeywordThis(): boolean {
		return this.type === SyntaxTokenType.Keyword && this.strValue === "this";
	}

	public isKeywordNull(): boolean {
		return this.type === SyntaxTokenType.Keyword && this.strValue === "null";
	}

	public isKeywordUndefined(): boolean {
		return this.type === SyntaxTokenType.Keyword && this.strValue === "undefined";
	}

	public isKeywordTrue(): boolean {
		return this.type === SyntaxTokenType.Keyword && this.strValue === "true";
	}

	public isKeywordFalse(): boolean {
		return this.type === SyntaxTokenType.Keyword && this.strValue === "false";
	}

	public isError() {
		return this.type === SyntaxTokenType.Error;
	}

	public toNumber() {
		return this.isNumber() ? this.numValue : -1;
	}

	public toString() {
		switch (this.type) {
			case SyntaxTokenType.Identifier:
			case SyntaxTokenType.PrivateIdentifier:
			case SyntaxTokenType.Character:
			case SyntaxTokenType.Keyword:
			case SyntaxTokenType.String:
			case SyntaxTokenType.Operator:
			case SyntaxTokenType.Error:
				return this.strValue;
			case SyntaxTokenType.Number:
				return this.numValue;
			default:
				return null;
		}
	}
}
