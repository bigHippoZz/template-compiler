import { Attribute, Element, Node, Comment, Text } from "./Ast";
import { Cursor } from "./CursorState";
import { Diagnostic } from "./Diagnostic";
import { SyntaxTokenType, Token, Lexer } from "./Lexer";
import { SourceLocation, SourceSpan, SourceFile } from "./SourceSpan";
import { Stack } from "./utils";

export class Parser {
	private _index: number = -1;
	private _elementStack: Stack<Element> = new Stack<any>();

	public rootNodes: Array<Node> = [];
	public diagnostics: string[] = [];

	constructor(private tokens: Array<Token>) {
		this._advance();
	}

	private get _current() {
		return this.tokens[this._index];
	}

	public _advance() {
		const prev = this._current;
		if (this._index < this.tokens.length - 1) {
			this._index++;
		}
		return prev;
	}

	private _advanceIf(type: SyntaxTokenType) {
		if (this._current.type === type) {
			return this._advance();
		}
		return null;
	}

	public build() {
		while (this._current.type !== SyntaxTokenType.EOF) {
			switch (this._current.type) {
				case SyntaxTokenType.TAG_OPEN_START:
					this._processTagOpenStart(this._advance());
					break;
				case SyntaxTokenType.TAG_CLOSE:
					this._processTagClosing(this._advance());
					break;
				case SyntaxTokenType.COMMENT_START:
					this._processCommentStart(this._advance());
					break;
				case SyntaxTokenType.CDATA_START:
					this._processCdataStart();
					break;
				case SyntaxTokenType.TEXT:
				case SyntaxTokenType.RAW_TEXT:
					this._processText(this._advance());
					break;
				default:
					this._advance();
					break;
			}
		}
	}

	private _processTagOpenStart(startTagToken: Token) {
		const [tagName] = startTagToken.parts;
		const attr: Attribute[] = [];
		while (this._current.type === SyntaxTokenType.ATTR_NAME) {
			attr.push(this._processAttribute(this._advance()));
		}

		let selfClosing = false;

		if (this._current.type === SyntaxTokenType.TAG_OPEN_END_VOID)
			selfClosing = true;
		this._advance();

		const el = new Element(
			tagName,
			attr,
			[],
			new SourceSpan(startTagToken.span.start, this._current.span.end),
			new SourceSpan(startTagToken.span.start, this._current.span.end),
			undefined
		);

		this._pushElement(el);

		if (selfClosing) this._popElement(tagName);
	}

	private _processAttribute(attrNameToken: Token): Attribute {
		const name = attrNameToken.parts[0];

		let attrEnd = attrNameToken.span.end;

		if (this._current.type === SyntaxTokenType.ATTR_QUOTE) {
			this._advance();
		}

		let value: string = "";
		const valueTokens: Token[] = [];
		let valueStartSpan: SourceSpan | undefined = undefined;
		let valueEnd: SourceLocation | undefined = undefined;

		if (this._current.type === SyntaxTokenType.ATTR_VALUE_TEXT) {
			valueStartSpan = this._current.span;
			valueEnd = this._current.span.end;
			while (
				this._current.type === SyntaxTokenType.ATTR_VALUE_TEXT ||
				this._current.type === SyntaxTokenType.ATTR_VALUE_INTERPOLATION
			) {
				const valueToken = this._advance();
				valueTokens.push(valueToken);
				value += valueToken.parts.join("");

				valueEnd = attrEnd = valueToken.span.end;
			}
		}

		if (this._current.type === SyntaxTokenType.ATTR_QUOTE) {
			const quoteToken = this._advance();
			attrEnd = quoteToken.span.end;
		}

		const valueSpan =
			valueStartSpan &&
			valueEnd &&
			new SourceSpan(valueStartSpan.start, valueEnd);

		return new Attribute(
			name,
			value,
			new SourceSpan(attrNameToken.span.start, attrEnd),
			attrNameToken.span,
			valueSpan,
			valueTokens.length > 0 ? valueTokens : undefined
		);
	}

	private _processTagClosing(tagClosingToken: Token) {
		if (!this._popElement(tagClosingToken.parts[0])) {
			this.diagnostics.push(
				`Unexpected Tag '${tagClosingToken.parts[0]}'`
			);
		}
	}

	private _processCdataStart() {
		this._processText(this._advance());
		this._advanceIf(SyntaxTokenType.CDATA_END);
	}

	private _processCommentStart(commentToken: Token) {
		const text = this._advanceIf(SyntaxTokenType.RAW_TEXT);
		this._advanceIf(SyntaxTokenType.COMMENT_END);
		const value = text?.parts[0] ? text.parts[0].trim() : null;
		this._addToParent(new Comment(value, commentToken.span));
	}

	private _processText(token: Token) {
		const tokens: Token[] = [token];
		const startSpan = token.span;
		let text = token.parts[0];
		while (
			this._current.type === SyntaxTokenType.INTERPOLATION ||
			this._current.type === SyntaxTokenType.TEXT
		) {
			token = this._advance();
			tokens.push(token);
			text += token.parts.join("");
		}
		if (text.length > 0) {
			const endSpan = token.span;
			this._addToParent(
				new Text(
					text,
					new SourceSpan(startSpan.start, endSpan.end),
					tokens
				)
			);
		}
	}

	private _addToParent(node: Node) {
		const parent = this._getParentElement();
		parent ? parent.children.push(node) : this.rootNodes.push(node);
	}

	private _getParentElement(): Element | null {
		return this._elementStack.peek();
	}

	private _popElement(tagName: string) {
		const element = this._elementStack.forwardToValue(
			(el) => el.name === tagName
		);
		return !!element;
	}

	private _pushElement(el: Element) {
		this._addToParent(el);
		this._elementStack.push(el);
	}
}

export function templateParse(template: string) {
	const lexer = new Lexer(
		new Cursor(new SourceFile(template)),
		new Diagnostic()
	);
	lexer.lex();
	const parser = new Parser(lexer.tokens);
	parser.build();
	return new ParseTreeResult(parser.rootNodes, parser.diagnostics);
}

export class ParseTreeResult {
	constructor(public nodes: Node[], public diagnostics: string[]) {}
}
