export class ParseSourceFile {
	constructor(public input: string) {}
}

export class ParseLocation {
	constructor(
		public file: ParseSourceFile,
		public offset: number,
		public line: number,
		public column: number,
	) {}
	getContext() {}
}

export class ParseSourceSpan {
	constructor(
		public start: ParseLocation,
		public end: ParseLocation,
		public details: string | null = null,
	) {}
}

export enum ParseErrorLevel {
	Warning = 1,
	Error = 2,
}

export class ParseError {
	constructor(
		public span: ParseSourceSpan,
		public msg: string,
		public errorLevel: ParseErrorLevel = ParseErrorLevel.Warning,
	) {}
}
