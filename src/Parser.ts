import { State, Token } from "./Lexer";
import { TextSpan } from "./TextSpan";
import { Stack } from "./utils";
import { SourceSpan } from "./CursorState";

export class Parser {
	private _index: number = 0;

	private _elementStack: Stack<Element> = new Stack<any>();

	public rootNodes: Array<Node> = [];

	constructor(private tokens: Array<Token>) {
		this.advance();
	}

	private get _current() {
		return this.tokens[this._index];
	}

	public advance() {
		const prev = this._current;
		if (this._index < this.tokens.length - 1) {
			this._index++;
		}
		return prev;
	}

	public build() {
		while (this._current.type !== State.EOF) {
			switch (this._current.type) {
				case State.TAG_OPEN_START:
					this._processTagOpenStart(this.advance());
					break;
				case State.TAG_CLOSE:
					this._processTagClosing(this.advance());
					break;
				case State.COMMENT_START:
					this._processCommentStart(this.advance());
					break;
				case State.CDATA_START:
					this._processCdataStart(this.advance());
					break;
				case State.RAW_TEXT:
				case State.TEXT:
					this._processText(this.advance());
					break;
				default:
					this.advance();
					break;
			}
		}
	}

	private _processTagOpenStart(startTagToken: Token) {
		// const [tagName] = startTagToken.parts;
		// const attr: Attribute[] = [];
		// while (this._current.type === State.ATTR_NAME) {
		// 	attr.push(this._processAttribute(this.advance()));
		// }
		// let selfClose = false;
		// if (this._current.type === State.TAG_OPEN_END_VOID) {
		// 	this.advance();
		// 	selfClose = true;
		// } else if (this._current.type === State.TAG_OPEN_END) {
		// 	this.advance();
		// }
		// const el: Element;
		// this._pushElement(el);
		// selfClose && this._popElement();
	}

	private _popElement() {}

	private _pushElement(el: Element) {
		this._addToParent(el);
		this._elementStack.push(el);
	}

	private _processAttribute(attrNameToken: Token): Attribute {
		const name = attrNameToken.parts[0];
		let value: string = "";
		let valueSpan: SourceSpan;
		let end: TextSpan;
		if (this._current.type === State.ATTR_QUOTE) {
			this.advance();
		}
		if (this._current.type === State.ATTR_VALUE) {
			const valueToken = this.advance();
			value = valueToken.parts[0];
			valueSpan = valueToken.span;
		}
		if (this._current.type === State.ATTR_QUOTE) {
			const quoteToken = this.advance();
			end = quoteToken.span.end;
		}

		const keySpan = new SourceSpan(
			attrNameToken.span.start,
			attrNameToken.span.end
		);

		return new Attribute(
			name,
			value,
			new SourceSpan(attrNameToken.span.start, end!),
			keySpan,
			valueSpan!
		);
	}

	private _processTagClosing() {}

	private _processCdataStart() {}

	private _processCommentStart() {}

	private _processText() {}

	private _addToParent(node: Node) {
		const parent = this._getParentElement();
		parent ? parent.children.push(node) : this.rootNodes.push(node);
	}

	private _getParentElement(): Element | null {
		return this._elementStack.peek();
	}
}

export abstract class Node {}

export class Attribute extends Node {
	constructor(
		public name: string,
		public value: string,
		public sourceSpan: SourceSpan,
		public readonly nameSourceSpan?: SourceSpan,
		public readonly valueSourceSpan?: SourceSpan
	) {
		super();
	}
	public visit() {}
}

export class Element extends Node {
	constructor(
		public name: string,
		public attributes: Attribute[],
		public children: Node[],
		public sourceSpan: SourceSpan,
		public readonly startSourceSpan: SourceSpan,
		public readonly endSourceSpan: SourceSpan | null = null
	) {
		super();
	}
	public visit() {}
}

export class Text extends Node {
	constructor(public value: string, public sourceSpan: SourceSpan) {
		super();
	}
	public visit() {}
}

export class Comment extends Node {
	constructor(public value: string | null, public sourceSpan: SourceSpan) {
		super();
	}
	public visit() {}
}

export interface Visitor {
	visit?(node: Node, context: any): any;
	visitElement(element: Element, context: any): any;
	visitAttribute(attribute: Attribute, context: any): any;
	visitText(text: Text, context: any): any;
	visitComment(comment: Comment, context: any): any;
}
