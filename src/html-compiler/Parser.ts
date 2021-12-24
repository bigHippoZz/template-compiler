import { AST } from "./AST";
import { TagDefinition } from "./HtmlTags";
import { Lexer } from "./Lexer";
import { ParseError, ParseSourceSpan, ParseLocation } from "./ParseSourceFile";
export namespace Parser {
	export class Parser {
		constructor(public getTagDefinition: (tagName: string) => TagDefinition) {}
		public parse(template: string) {
			const tokenize = Lexer.tokenize(template);
			const parser = new _TreeBuilder(tokenize.tokens, this.getTagDefinition);
			parser.build();
			return new ParseTreeResult(parser.rootNodes, parser.errors);
		}
	}
	export class ParseTreeResult {
		constructor(public rootNodes: AST.Node[], public errors: ParseError[]) {}
	}

	export class TreeBuilderError extends ParseError {
		constructor(
			public elementName: string | null,
			message: string,
			sourceSpan: ParseSourceSpan,
		) {
			super(sourceSpan, message);
		}
	}

	export class _TreeBuilder {
		public rootNodes: AST.Node[] = [];
		public errors: TreeBuilderError[] = [];

		private _index: number = -1;
		private _stack: AST.Element[] = [];
		constructor(
			private _tokens: Lexer.Token[],
			private getTagDefinition: (tagName: string) => TagDefinition,
		) {
			this._advance();
		}

		private get _current(): Lexer.Token {
			return this._tokens[this._index];
		}

		public build(): void {
			while (this._shouldStop()) {
				const currentType = this._current.type;

				if (
					currentType === Lexer.TokenType.TAG_OPEN_START ||
					currentType === Lexer.TokenType.INCOMPLETE_TAG_OPEN
				) {
					this._consumeTagOpen(this._advance());
				} else if (currentType === Lexer.TokenType.TAG_CLOSE) {
					this._consumeTagClose(this._advance());
				} else if (currentType === Lexer.TokenType.CODE_DATA_START) {
					this._closeVoidElement();
					this._consumeCodeData(this._advance());
				} else if (currentType === Lexer.TokenType.COMMENT_START) {
					this._closeVoidElement();
					this._consumeComment(this._advance());
				} else if (
					currentType === Lexer.TokenType.TEXT ||
					currentType === Lexer.TokenType.RAW_TEXT
				) {
					this._closeVoidElement();
					this._consumeText(this._advance());
				} else {
					this._advance();
				}
			}
		}

		private _closeVoidElement() {
			const parent = this._getParentElement();
			if (parent && this.getTagDefinition(parent.name).isVoid) {
				this._stack.pop();
			}
		}

		private _consumeTagOpen(tagOpenToken: Lexer.Token) {
			const tagName = tagOpenToken.parts[0];

			// process attr
			const attributes: AST.Attribute[] = [];
			while (this._current.type === Lexer.TokenType.ATTR_NAME) {
				attributes.push(this._consumeAttr(this._advance()));
			}

			let isSelfClosing = false;
			if (this._current.type === Lexer.TokenType.TAG_OPEN_END) {
				this._advance();
				isSelfClosing = false;
			} else if (this._current.type === Lexer.TokenType.TAG_OPEN_VOID) {
				this._advance();
				isSelfClosing = true;
				const defTagName = this.getTagDefinition(tagName);
				if (!(defTagName.isVoid || !defTagName.canSelfClose)) {
					this.errors.push(
						new TreeBuilderError(
							tagName,
							`Only void and foreign elements can be self closed "${tagName}"`,
							tagOpenToken.sourceSpan,
						),
					);
				}
			}

			const end = this._current.sourceSpan.start;

			const span = new ParseSourceSpan(tagOpenToken.sourceSpan.start, end);

			const startSpan = new ParseSourceSpan(tagOpenToken.sourceSpan.start, end);

			const element = new AST.Element(tagName, attributes, [], span, startSpan, undefined);

			this._pushElement(element);

			if (isSelfClosing) {
				this._popElement(tagName, span);
			} else if (tagOpenToken.type === Lexer.TokenType.INCOMPLETE_TAG_OPEN) {
				this._popElement(tagName, null);
				this.errors.push(
					new TreeBuilderError(tagName, `Opening tag "${tagName}" not terminated.`, span),
				);
			}
		}

		private _pushElement(element: AST.Element) {
			this._addToParent(element);

			this._stack.push(element);
		}

		private _addToParent(element: AST.Node) {
			const parent = this._getParentElement();

			parent ? parent.children.push(element) : this.rootNodes.push(element);
		}

		private _getParentElement(): AST.Element | null {
			return this._stack.length ? this._stack[this._stack.length - 1] : null;
		}

		private _popElement(tagName: string, endSourceSpan: ParseSourceSpan | null) {}

		private _consumeAttr(attributeToken: Lexer.Token) {
			const attributeName = attributeToken.parts[0],
				tokens: Lexer.Token[] = [];

			let attrEnd = attributeToken.sourceSpan.end,
				attributeValue: string = "",
				valueStartSpan: ParseSourceSpan | undefined,
				valueEnd: ParseLocation | undefined;

			if (this._current.type === Lexer.TokenType.ATTR_QUOTE) {
				this._advance();
			}

			if (this._current.type === Lexer.TokenType.ATTR_VALUE_TEXT) {
				const valueToken = this._advance();
				valueStartSpan = valueToken.sourceSpan;
				valueEnd = attrEnd = valueToken.sourceSpan.end;
				attributeValue = valueToken.parts.join("");
				tokens.push(valueToken);
			}

			if (this._current.type === Lexer.TokenType.ATTR_QUOTE) {
				const quoteToken = this._advance();
				attrEnd = quoteToken.sourceSpan.end;
			}

			const valueSpan =
				valueStartSpan && valueEnd && new ParseSourceSpan(valueStartSpan.start, valueEnd);

			return new AST.Attribute(
				attributeName,
				attributeValue,
				tokens.length ? tokens : void 0,
				new ParseSourceSpan(attributeToken.sourceSpan.start, attrEnd),
				attributeToken.sourceSpan,
				valueSpan,
			);
		}

		private _consumeTagClose(tagCloseToken: Lexer.Token) {}

		private _consumeText(textToken: Lexer.Token) {
			const tokens = [textToken];
			const startToken = textToken.sourceSpan.start;

			let text = textToken.parts.join("");

			while (
				this._current.type === Lexer.TokenType.TEXT ||
				this._current.type === Lexer.TokenType.INTERPOLATION
			) {
				const current = this._advance();
				tokens.push(current);
				text += current.parts.join("");
			}

			const textAst = new AST.Text(text, tokens, new ParseSourceSpan(startToken, startToken));
		}

		private _consumeComment(commentToken: Lexer.Token) {
			const text = this._advanceIf(Lexer.TokenType.RAW_TEXT);
			const end = this._advanceIf(Lexer.TokenType.CODE_DATA_END);
			const value = text?.parts[0].trim() ?? "";
			this._addToParent(
				new AST.Comment(
					value,
					new ParseSourceSpan(commentToken.sourceSpan.start, end?.sourceSpan.end!),
				),
			);
		}

		private _consumeCodeData(codeDataToken: Lexer.Token) {}

		private _shouldStop() {
			return this._current.type !== Lexer.TokenType.EOF;
		}

		private _advance(): Lexer.Token {
			const prev = this._current;
			if (this._index < this._tokens.length - 1) {
				this._index++;
			}
			return prev;
		}

		private _advanceIf(type: Lexer.TokenType): Lexer.Token | null {
			if (this._current.type === type) {
				return this._advance();
			}
			return null;
		}
	}
}
