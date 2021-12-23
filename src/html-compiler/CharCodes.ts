export enum CharCodes {
	SingleQuote = 39, // "'"
	DoubleQuote = 34, // """
	Backticks = 96, // "`"

	LowerToken = 60, // <
	EqualToken = 61, // =
	GreaterToken = 62, // >

	Tab = 9, // "\t"
	NewLine = 10, // "\n"
	Vtab = 11, // 垂直制表符 \v
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

	Lparen = 40, // (
	Rparen = 41, // )
	Lbrace = 123, // {
	Rbrace = 125, // }
	Lbracket = 91, // [
	Rbracket = 93, // ]
	Comma = 44, // ,
	Colon = 58, // :
	Semicolon = 59, // ;
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

export function isNewLine(code: number) {
	return code === CharCodes.NewLine || code === CharCodes.CarriageReturn;
}

export function isAsciiLetter(code: number) {
	return (
		(code >= CharCodes.LowerA && code <= CharCodes.LowerZ) ||
		(code >= CharCodes.UpperA && code <= CharCodes.UpperZ)
	);
}

export function isDigit(code: number) {
	return code >= CharCodes.Zero && code <= CharCodes.Nine;
}

export function isPrefixName(code: number) {
	return isAsciiLetter(code) || isDigit(code);
}

export function isWhitespace(code: number) {
	return (
		(code >= CharCodes.Tab && code <= CharCodes.CarriageReturn) ||
		code === CharCodes.Space ||
		code === CharCodes.Nbsp
	);
}

export function isNotWhitespace(code: number) {
	return !isWhitespace(code) || code === CharCodes.EOF;
}

export function isNameEnd(code: number) {
	return (
		code === CharCodes.EqualToken ||
		code === CharCodes.SingleQuote ||
		code === CharCodes.DoubleQuote ||
		code === CharCodes.Slash ||
		code === CharCodes.GreaterToken ||
		code === CharCodes.LowerToken ||
		isWhitespace(code) ||
		code === CharCodes.EOF
	);
}

export function isQuote(code: number): boolean {
	return (
		code === CharCodes.SingleQuote ||
		code === CharCodes.DoubleQuote ||
		code === CharCodes.Backticks
	);
}
