export enum CharCodes {
	SingleQuote = 39, // "'"
	DoubleQuote = 34, // """
	Backticks = 96, // "`"

	LowerToken = 60, // <
	EqualToken = 61, // =
	GreaterToken = 62, // >

	Tab = 9, // "\t"
	NewLine = 10, // "\n"
	Vtab = 13, // 垂直制表符 \v
	FormFeed = 12, // "\f"
	CarriageReturn = 13, // "\r"
	Space = 32, // " "

	ExclamationMark = 33, // "!"

	QuestionMark = 63, // "?"

	Zero = 48, // "0"
	Nine = 57, // "9"

	UpperA = 0x41, // "A"
	LowerA = 0x61, // "a"
	LowerE = 101, // "e"
	UpperE = 69, // "E"
	LowerU = 117, // "u"
	LowerN = 110, // "n"
	LowerR = 114, // "r"
	LowerT = 116, // "t"
	LowerV = 118, // "v"

	UpperF = 0x46, // "F"
	LowerF = 0x66, // "f"
	UpperZ = 0x5a, // "Z"
	LowerZ = 0x7a, // "z"
	LowerX = 0x78, // "x"

	Brackets = 91, // '['

	EOF = 0, // EOF

	Underscore = 95, // _
	Dollar = 36, // $

	LPAREN = 40, // (
	RPAREN = 41, // )

	LBRACE = 123, // {
	RBRACE = 125, // }

	LBRACKET = 91, // [
	RBRACKET = 93, // ]

	COMMA = 44, // ,
	COLON = 58, // :
	SEMICOLON = 59, // ;
	Period = 46, // .

	HASH = 35, // #

	Plus = 43, // +
	Minus = 45, // "-"
	Star = 42, // "-"
	Slash = 47, // "/"
	Percent = 37, // %
	Caret = 94, // ^
	Ampersand = 38, // &

	Bar = 124, // |
	Nbsp = 160, // &nbsp
	Backslash = 92, // \
}

/**
 *
 * 文件中的换行符号：
 * linux,unix: \r\n
 * windows: \n
 * Mac OS: \r
 *
 */

export function isAsciiLetter(code: number): boolean {
	return (
		(code >= CharCodes.LowerA && code <= CharCodes.LowerZ) ||
		(code >= CharCodes.UpperA && code <= CharCodes.UpperZ)
	);
}

export function isDigit(code: number): boolean {
	return CharCodes.Zero <= code && code <= CharCodes.Nine;
}

export function isWhitespace(code: number): boolean {
	return (
		code === CharCodes.Space ||
		code === CharCodes.NewLine ||
		code === CharCodes.Tab ||
		code === CharCodes.FormFeed ||
		code === CharCodes.CarriageReturn
	);
}
export function isNotWhitespace(code: number): boolean {
	return !isWhitespace(code) || code === CharCodes.EOF;
}

export function isNewLine(code: number): boolean {
	return code === CharCodes.NewLine || code === CharCodes.CarriageReturn;
}

export function isQuote(code: number) {
	return (
		CharCodes.SingleQuote === code ||
		CharCodes.DoubleQuote === code ||
		CharCodes.Backticks === code
	);
}

export function isPrefixEnd(code: number): boolean {
	return isAsciiLetter(code) && code >= CharCodes.Zero && code <= CharCodes.Nine;
}

export function isNameEnd(code: number): boolean {
	return (
		isWhitespace(code) ||
		code === CharCodes.SingleQuote || // "'"
		code === CharCodes.DoubleQuote || // """
		code === CharCodes.EqualToken || // "="
		code === CharCodes.Slash || // "/"
		code === CharCodes.GreaterToken || // ">"
		code === CharCodes.LowerToken || // "<"
		code === CharCodes.EOF // ""
	);
}
