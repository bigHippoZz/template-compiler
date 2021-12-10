export enum CharCodes {
	SingleQuote = 39,
	DoubleQuote = 34,
	Backticks = 96,

	LowerToken = 60,
	EqualToken = 61,
	GreaterToken = 62,

	Tab = 9,
	NewLine = 10,
	FormFeed = 12,
	CarriageReturn = 13,
	Space = 32,

	ExclamationMark = 33,
	Dash = 45,
	Slash = 47,
	Questionmark = 63,

	Zero = 48,
	Nine = 57,

	UpperA = 0x41,
	LowerA = 0x61,
	UpperF = 0x46,
	LowerF = 0x66,
	UpperZ = 0x5a,
	LowerZ = 0x7a,
	LowerX = 0x78,

	EOF = 0,
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
	return (
		isAsciiLetter(code) && code >= CharCodes.Zero && code <= CharCodes.Nine
	);
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
