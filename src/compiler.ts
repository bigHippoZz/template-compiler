import { BindParser } from "./bind/Parser";
import { ExpressionLexer } from "./expression-compiler/Lexer";
import { ExpressionParser } from "./expression-compiler/Parser";
import { TagAST } from "./html-compiler/AST";
import { getHtmlTagDefinition } from "./html-compiler/HtmlTags";
import { Parser } from "./html-compiler/Parser";

import { HtmlAstToRenderAst } from "./render/Template";

export function parseTemplate(template: string) {
	const bindingParser = new BindParser.Parser(
		new ExpressionParser.Parser(new ExpressionLexer.Lexer()),
	);
	const htmlParser = new Parser.Parser(getHtmlTagDefinition);

	const parseResult = htmlParser.parse(template);

	const visitor = new HtmlAstToRenderAst(bindingParser);

	return TagAST.visitAll(visitor, parseResult.rootNodes);
}
