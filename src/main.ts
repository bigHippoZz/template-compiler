// import { ExpressionLexer } from "./expression-compiler/Lexer";

import { parseTemplate } from "./compiler";

// import { ExpressionParser } from "./expression-compiler/Parser";

// import { Parser } from "./html-compiler/Parser";

// export { Parser } from "./html-compiler/Parser";

// import { getHtmlTagDefinition } from "./html-compiler/HtmlTags";

// export { Lexer } from "./html-compiler/Lexer";

// export { ExpressionLexer } from "./expression-compiler/Lexer";

// export { ExpressionParser } from "./expression-compiler/Parser";

// export { RenderAST } from "./render/AST";
// // export { HtmlAstToRenderAst } from "./render/Template";

// const expressionTem = `
// 1 + 2  * ( 3 ) + 2 * 3
// `;

// const lexer = new ExpressionLexer.Lexer();

// console.log(lexer.tokenize(expressionTem));

// const parser = new ExpressionParser._ParseAST(expressionTem, lexer.tokenize(expressionTem));

// console.log(parser);

// console.log(parser.parseExpression());
// const html = `<div v-for="let item of [1,4,5,6,56]" :title="win.title" > {{ 1 + 2  }}</div>`;

// const htmlParser = new Parser.Parser(getHtmlTagDefinition);

// console.log(htmlParser.parse(html));

const template = `<div v-for="let item of user" >
<h1>
 {{  11111 }}
</h1>
{{ 1+ 2  }}
hello world
<h1>
 {{  kkk }}
</h1>
{{ a  }}
</div>`;

console.log(parseTemplate(template));
