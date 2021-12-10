(function (l, r) {
  if (!l || l.getElementById('livereloadscript')) return;
  r = l.createElement('script');
  r.async = 1;
  r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1';
  r.id = 'livereloadscript';
  l.getElementsByTagName('head')[0].appendChild(r);
})(self.document);

var CharCodes;

(function (CharCodes) {
  CharCodes[CharCodes["SingleQuote"] = 39] = "SingleQuote";
  CharCodes[CharCodes["DoubleQuote"] = 34] = "DoubleQuote";
  CharCodes[CharCodes["Backticks"] = 96] = "Backticks";
  CharCodes[CharCodes["LowerToken"] = 60] = "LowerToken";
  CharCodes[CharCodes["EqualToken"] = 61] = "EqualToken";
  CharCodes[CharCodes["GreaterToken"] = 62] = "GreaterToken";
  CharCodes[CharCodes["Tab"] = 9] = "Tab";
  CharCodes[CharCodes["NewLine"] = 10] = "NewLine";
  CharCodes[CharCodes["FormFeed"] = 12] = "FormFeed";
  CharCodes[CharCodes["CarriageReturn"] = 13] = "CarriageReturn";
  CharCodes[CharCodes["Space"] = 32] = "Space";
  CharCodes[CharCodes["ExclamationMark"] = 33] = "ExclamationMark";
  CharCodes[CharCodes["Dash"] = 45] = "Dash";
  CharCodes[CharCodes["Slash"] = 47] = "Slash";
  CharCodes[CharCodes["Questionmark"] = 63] = "Questionmark";
  CharCodes[CharCodes["Zero"] = 48] = "Zero";
  CharCodes[CharCodes["Nine"] = 57] = "Nine";
  CharCodes[CharCodes["UpperA"] = 65] = "UpperA";
  CharCodes[CharCodes["LowerA"] = 97] = "LowerA";
  CharCodes[CharCodes["UpperF"] = 70] = "UpperF";
  CharCodes[CharCodes["LowerF"] = 102] = "LowerF";
  CharCodes[CharCodes["UpperZ"] = 90] = "UpperZ";
  CharCodes[CharCodes["LowerZ"] = 122] = "LowerZ";
  CharCodes[CharCodes["LowerX"] = 120] = "LowerX";
  CharCodes[CharCodes["EOF"] = 0] = "EOF";
})(CharCodes || (CharCodes = {}));
/**
 *
 * 文件中的换行符号：
 * linux,unix: \r\n
 * windows: \n
 * Mac OS: \r
 *
 */


function isAsciiLetter(code) {
  return code >= CharCodes.LowerA && code <= CharCodes.LowerZ || code >= CharCodes.UpperA && code <= CharCodes.UpperZ;
}

function isDigit(code) {
  return CharCodes.Zero <= code && code <= CharCodes.Nine;
}

function isWhitespace(code) {
  return code === CharCodes.Space || code === CharCodes.NewLine || code === CharCodes.Tab || code === CharCodes.FormFeed || code === CharCodes.CarriageReturn;
}

function isNotWhitespace(code) {
  return !isWhitespace(code) || code === CharCodes.EOF;
}

function isNewLine(code) {
  return code === CharCodes.NewLine || code === CharCodes.CarriageReturn;
}

function isQuote(code) {
  return CharCodes.SingleQuote === code || CharCodes.DoubleQuote === code || CharCodes.Backticks === code;
}

function isPrefixEnd(code) {
  return isAsciiLetter(code) && code >= CharCodes.Zero && code <= CharCodes.Nine;
}

function isNameEnd(code) {
  return isWhitespace(code) || code === CharCodes.SingleQuote || // "'"
  code === CharCodes.DoubleQuote || // """
  code === CharCodes.EqualToken || // "="
  code === CharCodes.Slash || // "/"
  code === CharCodes.GreaterToken || // ">"
  code === CharCodes.LowerToken || // "<"
  code === CharCodes.EOF // ""
  ;
}

export { CharCodes, isAsciiLetter, isDigit, isNameEnd, isNewLine, isNotWhitespace, isPrefixEnd, isQuote, isWhitespace };
