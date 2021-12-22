import { Lexer } from './html-compiler/Lexer';

const template = `<!-- HTML5 Shim and Respond.js -->`;

const result = Lexer.tokenize(template);

console.log(result);
