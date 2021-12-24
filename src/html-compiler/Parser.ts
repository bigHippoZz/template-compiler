import { TagAST } from "./AST";
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
		constructor(public rootNodes: TagAST.Node[], public errors: ParseError[]) {}
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
		public rootNodes: TagAST.Node[] = [];
		public errors: TreeBuilderError[] = [];

		private _index: number = -1;
		private _stack: TagAST.Element[] = [];
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
			const attributes: TagAST.Attribute[] = [];
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

			const element = new TagAST.Element(tagName, attributes, [], span, startSpan, undefined);

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

		private _pushElement(element: TagAST.Element) {
			this._addToParent(element);

			this._stack.push(element);
		}

		private _addToParent(element: TagAST.Node) {
			const parent = this._getParentElement();

			parent ? parent.children.push(element) : this.rootNodes.push(element);
		}

		private _getParentElement(): TagAST.Element | null {
			return this._stack.length ? this._stack[this._stack.length - 1] : null;
		}

		private _popElement(tagName: string, endSourceSpan: ParseSourceSpan | null) {
			for (let i = this._stack.length - 1; i >= 0; i--) {
				const element = this._stack[i];
				if (element.name === tagName) {
					element.endSourceSpan = endSourceSpan;
					if (endSourceSpan) {
						element.sourceSpan.end = endSourceSpan.end;
					}
					this._stack.splice(i, this._stack.length - i);
					return true;
				}
			}
			return false;
		}

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

			return new TagAST.Attribute(
				attributeName,
				attributeValue,
				tokens.length ? tokens : void 0,
				new ParseSourceSpan(attributeToken.sourceSpan.start, attrEnd),
				attributeToken.sourceSpan,
				valueSpan,
			);
		}

		private _consumeTagClose(tagCloseToken: Lexer.Token) {
			const tagName = tagCloseToken.parts[0];
			if (this.getTagDefinition(tagName).isVoid) {
				this.errors.push(
					new TreeBuilderError(
						tagName,
						`Void elements do not have end tags "${tagName}"`,
						tagCloseToken.sourceSpan,
					),
				);
			} else if (!this._popElement(tagName, tagCloseToken.sourceSpan)) {
				const errMsg = `Unexpected closing tag "${tagName}". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags`;
				this.errors.push(new TreeBuilderError(tagName, errMsg, tagCloseToken.sourceSpan));
			}
		}

		private _consumeText(textToken: Lexer.Token) {
			const tokens = [textToken];
			const startToken = textToken.sourceSpan.start;

			let currentToken: Lexer.Token | undefined = undefined;

			let text = textToken.parts.join("");

			while (
				this._current.type === Lexer.TokenType.TEXT ||
				this._current.type === Lexer.TokenType.INTERPOLATION
			) {
				currentToken = this._advance();
				tokens.push(currentToken);
				text += currentToken.parts.join("");
			}

			if (text.length) {
				const endSpan = currentToken?.sourceSpan ?? textToken.sourceSpan;
				this._addToParent(
					new TagAST.Text(text, tokens, new ParseSourceSpan(startToken, endSpan.end)),
				);
			}
		}

		private _consumeComment(commentToken: Lexer.Token) {
			const text = this._advanceIf(Lexer.TokenType.RAW_TEXT);
			const end = this._advanceIf(Lexer.TokenType.CODE_DATA_END);
			const value = text?.parts[0].trim() ?? "";
			this._addToParent(
				new TagAST.Comment(
					value,
					new ParseSourceSpan(commentToken.sourceSpan.start, end?.sourceSpan.end!),
				),
			);
		}

		private _consumeCodeData(_codeDataToken: Lexer.Token) {
			this._consumeText(this._advance());
			this._advanceIf(Lexer.TokenType.CODE_DATA_END);
		}

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
