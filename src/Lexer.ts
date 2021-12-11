import { Cursor, SourceSpan } from "./CursorState";
import { CharCodes, isAsciiLetter } from "./CharCodes";
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
			this.diagnostic.reportUnexpectedCharacter(this.cursor.peek());
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
		console.log(start);
	}

	private _consumeTagClose(start: Cursor) {
		// <div></div>
		this._matchingCharCode(CharCodes.GreaterToken);
		this._emitToken(State.TAG_CLOSE, [], start);
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
			this.diagnostic.reportUnexpectedCharacter(this.cursor.peek());
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

const template = `<template>
  <el-form ref="form" label-width="120px">
    <el-form-item label="Activity name">
      <el-input v-model="form.name"></el-input>
    </el-form-item>
    <el-form-item label="Activity zone">
      <el-select v-model="form.region" placeholder="please select your zone">
        <el-option label="Zone one" value="shanghai"></el-option>
        <el-option label="Zone two" value="beijing"></el-option>
      </el-select>
    </el-form-item>
    <el-form-item label="Activity time">
      <el-col>
        <el-date-picker
          v-model="form.date1"
          type="date"
          placeholder="Pick a date"
          style="width: 100%"
        ></el-date-picker>
      </el-col>
      <el-col class="line" :span="2">-</el-col>
      <el-col>
        <el-time-picker
          v-model="form.date2"
          placeholder="Pick a time"
          style="width: 100%"
        ></el-time-picker>
      </el-col>
    </el-form-item>
    <el-form-item label="Instant delivery">
      <el-switch v-model="form.delivery"></el-switch>
    </el-form-item>
    <el-form-item label="Activity type">
      <el-checkbox-group v-model="form.type">
        <el-checkbox label="Online activities" name="type"></el-checkbox>
        <el-checkbox label="Promotion activities" name="type"></el-checkbox>
        <el-checkbox label="Offline activities" name="type"></el-checkbox>
        <el-checkbox label="Simple brand exposure" name="type"></el-checkbox>
      </el-checkbox-group>
    </el-form-item>
    <el-form-item label="Resources">
      <el-radio-group v-model="form.resource">
        <el-radio label="Sponsor"></el-radio>
        <el-radio label="Venue"></el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item label="Activity form">
      <el-input v-model="form.desc" type="textarea"></el-input>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="onSubmit">Create</el-button>
      <el-button>Cancel</el-button>
    </el-form-item>
  </el-form>
</template>`;
console.log(template);
const expression = `<!-- hello -->{{ a }} {{ b}} {{ c}} {{ d}}`;
const lexer = new Lexer(new Cursor(expression), new Diagnostic());
lexer.lex();
console.log(lexer.tokens);
