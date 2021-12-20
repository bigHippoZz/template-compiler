import { SyntaxTokenType, Token } from "./Lexer";
import { CharCodes } from "../CharCodes";
import { Call, KeyRead, KeyWrite, SafeKeyRead } from "./Ast";
import {
	AST,
	LiteralPrimitive,
	ThisReceiver,
	ParseSpan,
	AbsoluteSourceSpan,
	PropertyRead,
	PropertyWrite,
	Binary,
	LiteralArray,
	EmptyExpression,
	Conditional,
	PrefixNot,
	Unary,
	SafePropertyRead,
} from "./Ast";

export class Parser {}

export const EOF = new Token(-1, -1, SyntaxTokenType.Character, 0, "");

export class ParserAst {
	private _parensExpected: number = 0;
	private _bracketsExpected: number = 0;
	private _bracesExpected: number = 0;

	private _context: ParseContextFlag = ParseContextFlag.None;

	private _index: number = 0;

	constructor(
		public input: string,
		public location: string,
		public abstractPosition: number,
		public tokens: Token[],
		public inputLength: number,
		public parseAction: boolean,
		private _diagnostics: Array<string> = [],
		private offset: number,
	) {}

	private get _next() {
		return this._peek(0);
	}

	private get _currentEndIndex() {
		return;
	}

	private _peek(offset: number = 0) {
		const index = this._index + offset;
		return this._reachEnd() ? EOF : this.tokens[index];
	}

	private _reachEnd() {
		return this._index >= this.tokens.length;
	}

	private _advance() {
		this._index++;
	}

	private _parseExpression(): AST {
		return this._parseConditional();
	}

	private _parseConditional(): AST {
		// a ? b : c
		const condition = this._parseLogicalOr();
		if (this._consumeOptionalOperator("?")) {
			const yes = this._parseExpression();
			this._expectCharacter(CharCodes.COLON);
			const no = this._parseExpression();
			return new Conditional(condition, yes, no);
		}
		return this._parseLogicalOr();
	}
	private _parseLogicalOr() {
		// ||
		let left = this._parseLogicalAnd();
		while (this._consumeOptionalOperator("||")) {
			const right = this._parseLogicalAnd();
			left = new Binary("||", left, right);
		}
		return left;
	}

	private _parseLogicalAnd(): AST {
		// &&
		let left = this._parseNullishCoalescing();
		while (this._consumeOptionalOperator("&&")) {
			const right = this._parseNullishCoalescing();
			left = new Binary("&&", left, right);
		}
		return left;
	}

	private _parseNullishCoalescing(): AST {
		// ??
		let left = this._parseEqual();
		while (this._consumeOptionalOperator("??")) {
			const right = this._parseEqual();
			left = new Binary("??", left, right);
		}
		return left;
	}

	private _parseEqual(): AST {
		// == != === !==
		let left = this._parseRelational();
		while (this._next.type === SyntaxTokenType.Operator) {
			const operator = this._next.strValue;
			switch (operator) {
				case "==":
				case "!=":
				case "===":
				case "!==":
					this._advance();
					const right = this._parseRelational();
					left = new Binary(operator, left, right);
					continue;
			}
			break;
		}
		return left;
	}

	private _parseRelational(): AST {
		//  >= > < <=
		let left = this._parseAdditive();
		while (this._next.type === SyntaxTokenType.Operator) {
			const operator = this._next.strValue;
			switch (operator) {
				case ">=":
				case ">":
				case "<=":
				case "<":
					this._advance();
					const right = this._parseAdditive();
					left = new Binary(operator, left, right);
					continue;
			}
			break;
		}
		return left;
	}

	private _parseAdditive(): AST {
		// + -

		// 1 + 2 * 3
		//   +
		//  / \
		// 1   *
		//    / \
		//   2   3

		let left = this._parseMultiplicative();
		while (this._next.type === SyntaxTokenType.Operator) {
			const operator = this._next.strValue;
			switch (operator) {
				case "+":
				case "-":
					this._advance();
					const right = this._parseMultiplicative();
					left = new Binary(operator, left, right);
					continue;
			}
			break;
		}
		return left;
	}

	private _parseMultiplicative(): AST {
		// * %  /
		let left = this._parsePrefix();
		while (this._next.type === SyntaxTokenType.Operator) {
			const operator = this._next.strValue;
			switch (operator) {
				case "*":
				case "/":
				case "%":
					this._advance();
					const right = this._parsePrefix();
					left = new Binary(operator, left, right);
					continue;
			}
			break;
		}
		return left;
	}

	private _parsePrefix(): AST {
		// ++ -- !!!
		if (this._next.type === SyntaxTokenType.Operator) {
			let left: AST;
			const operator = this._next.strValue;
			switch (operator) {
				case "+":
					this._advance();
					left = this._parsePrefix();
					return Unary.createPlus(left);
				case "-":
					this._advance();
					left = this._parsePrefix();
					return Unary.createMinus(left);
				case "!":
					this._advance();
					left = this._parsePrefix();
					return new PrefixNot(left);
			}
		}
		return this._parseCallChain();
	}

	private _parseCallChain(): AST {
		// methodName()
		// array[number]
		// obj.name
		// obj?.name
		// methodName?.()

		// ( => args)
		// . => obj.name
		//          ^^^^
		// [ => array[expression]
		//            ^^^^^^^^^^
		// ?. =>
		//      => (
		//      => [

		// ignore => return
		let left = this._parsePrimary();
		while (true) {
			if (this._consumeOptionalCharacter(CharCodes.LPAREN)) {
				const args = this._parseCallAssignments();
				this._expectCharacter(CharCodes.RPAREN);
				left = new Call(left, args);
			} else if (this._consumeOptionalCharacter(CharCodes.Period)) {
				left = this._parseAccessMemberOrCall(left);
			} else if (this._consumeOptionalCharacter(CharCodes.LBRACKET)) {
				left = this._parseKeyReadOrWrite(left);
			} else if (this._consumeOptionalOperator("?.")) {
				left = this._consumeOptionalCharacter(CharCodes.LPAREN)
					? this._parseKeyReadOrWrite(left, true)
					: this._parseAccessMemberOrCall(left, true);
			} else {
				return left;
			}
		}
	}

	private _parseKeyReadOrWrite(receiver: AST, isSafe: boolean = false) {
		const key = this._parseExpression();

		if (key instanceof EmptyExpression) {
			this._error("Key access cannot be empty");
		}

		this._expectCharacter(CharCodes.RBRACKET);

		if (this._consumeOptionalOperator("=")) {
			if (isSafe) {
				this._error("The '?.' operator cannot be used in the assignment");
				return new EmptyExpression();
			} else {
				const value = this._parseExpression();
				return new KeyWrite(receiver, key, value);
			}
		} else {
			return isSafe ? new SafeKeyRead(receiver, key) : new KeyRead(receiver, key);
		}
	}

	private _parsePrimary(): AST {
		this._parseKeyword();
		if (this._consumeOptionalCharacter(CharCodes.LPAREN)) {
			// ( )
			const result = this._parseExpression();
			this._expectCharacter(CharCodes.RPAREN); // )
			return result;
		} else if (this._next.isKeyword()) {
			// keyword
			return this._parseKeyword();
		} else if (this._next.isNumber()) {
			const value = this._next.numValue;
			this._advance();
			return new LiteralPrimitive(value);
		} else if (this._next.isString()) {
			// string
			const literalValue = this._next.strValue;
			this._advance();
			return new LiteralPrimitive(literalValue);
		} else if (this._consumeOptionalCharacter(CharCodes.LBRACKET)) {
			// []
			const element = this._parseExpressionList(CharCodes.RBRACKET);
			this._expectCharacter(CharCodes.RBRACKET);
			return new LiteralArray(element);
		} else if (this._next.isIdentifier()) {
			// identifier
			return this._parseAccessMemberOrCall();
		} else if (this._index >= this.tokens.length) {
			this._error(`Unexpected end of expression: ${this.input}`);
			return new EmptyExpression();
		} else {
			this._error(`Unexpected token ${this._next}`);
			return new EmptyExpression();
		}
	}

	private _parseExpressionList(code: number) {
		const result: AST[] = [];
		do {
			if (this._next.isCharacter(code)) break;
			result.push(this._parseExpression());
		} while (this._consumeOptionalCharacter(CharCodes.COMMA));
		return result;
	}

	private _skip() {
		let current = this._next;
		while (this._index < this.tokens.length) {
			this._advance();
			current = this._next;
		}
	}

	private _parseAccessMemberOrCall(thisReceiver: AST, isSafe: boolean = false) {
		const id = this._withContext(ParseContextFlag.Writable, () => {
			const id = this._expectedIdentifierOrKeyword() ?? "";
			if (!id.length) {
				this._error("Expected identifier for property access");
			}
			return id;
		});

		let receiver: AST;

		if (this._consumeOptionalOperator("=")) {
			if (isSafe) {
				this._error("The '?.' operator cannot be used in the assignment");
				receiver = new EmptyExpression();
			} else {
				const value = this._parseExpression();
				receiver = new PropertyWrite(thisReceiver, id, value);
			}
		} else {
			receiver = isSafe
				? new SafePropertyRead(thisReceiver, id)
				: new PropertyRead(thisReceiver, id);
		}

		if (this._consumeOptionalCharacter(CharCodes.LPAREN /* ( */)) {
			const args = this._parseCallAssignments();
			this._expectCharacter(CharCodes.RPAREN /* ) */);
			return new Call(receiver, args);
		}

		return receiver;
	}

	private _expectedIdentifierOrKeyword(): string | null {
		const current = this._next;
		if (!current.isIdentifier() && !current.isKeyword()) {
			return null;
		}
		this._advance();
		return current.toString() as string;
	}

	private _withContext<T>(context: ParseContextFlag, callback: () => T): T {
		this._context |= context;
		const result = callback();
		this._context ^= context;
		return result;
	}

	private _createSpan(): ParseSpan {
		return null as unknown as ParseSpan;
	}

	private _createSourceSpan(): AbsoluteSourceSpan {
		return null as unknown as AbsoluteSourceSpan;
	}

	private _parseCallAssignments() {
		if (this._next.isCharacter(CharCodes.RBRACE)) return [];
		const argsAst: AST[] = [];
		do {
			argsAst.push(this._parseExpression());
		} while (this._consumeOptionalCharacter(CharCodes.COMMA));
		return argsAst;
	}

	private _parseKeyword(): AST {
		let result: AST;
		if (this._next.isKeywordNull()) {
			result = new LiteralPrimitive(null);
		} else if (this._next.isKeywordUndefined()) {
			result = new LiteralPrimitive(void 0);
		} else if (this._next.isKeywordFalse()) {
			result = new LiteralPrimitive(false);
		} else if (this._next.isKeywordTrue()) {
			result = new LiteralPrimitive(true);
		} else if (this._next.isKeywordThis()) {
			result = new ThisReceiver();
		} else {
			throw new Error(`Unexpected Keyword: "${this._next.strValue}"`);
		}
		this._advance();
		return result!;
	}

	private _expectCharacter(code: number) {
		if (this._consumeOptionalCharacter(code)) return;
		this._error(`Unexpected character '${String.fromCharCode(code)}'`);
	}
	private _consumeOptionalCharacter(code: CharCodes) {
		if (this._next.isCharacter(code)) {
			this._advance();
			return true;
		}
		return false;
	}

	private _error(msg: string) {
		throw new Error(msg);
	}

	private _consumeOptionalOperator(operator: string) {
		if (this._next.isOperation(operator)) {
			this._advance();
			return true;
		}
		return false;
	}

	private _expectedOperator(operator: string) {
		if (this._consumeOptionalOperator(operator)) return;
		this._error("Unexpected Operator");
	}
}

export enum ParseContextFlag {
	None = 0,

	Writable = 1,
}
