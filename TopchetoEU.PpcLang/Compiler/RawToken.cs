using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler;

public record struct RawToken(RawTokenKind Kind, string data, Location location) {
    private static void AddToken(List<RawToken> tokens, List<char> currToken, ref RawTokenKind type, string filename, int start, int codestart, int line) {
        tokens.Add(new RawToken(type, string.Join("", currToken), new(filename, line, start, currToken.Count, codestart)));
        type = RawTokenKind.None;
    }

    public static IEnumerable<RawToken> ParseFile(string filename, TextReader f) => ParseMany(filename, f.ReadToEnd());
    public static IEnumerable<RawToken> ParseMany(string filename, string raw) {
        var tokens = new List<RawToken>();
        var currToken = new List<char>();
        bool escaping = false, comment = false, multicomment = false;
        RawTokenKind type = RawTokenKind.None;
        int start = 0, line = 0, codeStart = 0, currStart = 0, currLine = 0;

        for (int i = 0; i < raw.Length; i++) {
            char c = raw[i];
            var prevType = type;
            bool ended = true, repeat = true;

            if (comment) comment = c != '\n';
            else if (multicomment) multicomment = !(c == '/' && raw[i - 1] == '*');
            else if (type == RawTokenKind.StringLiteral || type == RawTokenKind.CharLiteral) {
                ended = false;
                if (!escaping) {
                    if (c == '\\')
                        escaping = true;
                    else if (c == (type == RawTokenKind.CharLiteral ? '\'' : '"')) {
                        ended = true;
                        repeat = false;
                    }
                }
                else
                    escaping = ended = false;
            }
            else if (type == RawTokenKind.OctalLiteral) {
                if (currToken.Count == 1 && currToken[0] == '0') {
                    ended = false;
                    if (c == 'b') type = RawTokenKind.BinaryLiteral;
                    else if (c == 'x') type = RawTokenKind.HexLiteral;
                    else if (c == '.' && i + 1 < raw.Length && raw[i + 1].IsDigit()) type = RawTokenKind.FloatLiteral;
                    else ended = !c.IsOctal();
                }
                else ended = !c.IsOctal();
            }
            else if (type == RawTokenKind.DecimalLiteral) {
                ended = false;
                if (c == '.' && i + 1 < raw.Length && raw[i + 1].IsDigit()) type = RawTokenKind.FloatLiteral;
                else if (!c.IsDigit()) ended = true;
            }
            else if (type == RawTokenKind.FloatLiteral) ended = !c.IsDigit();
            else if (type == RawTokenKind.HexLiteral) ended = !c.IsHex();
            else if (type == RawTokenKind.BinaryLiteral) ended = !c.IsAny("01");
            else if (type == RawTokenKind.Identifier) ended = !c.is_alphanumeric() && c != '_';
            else if (type == RawTokenKind.Operator) {
                if (currToken.Count == 1) {
                    if (currToken[0] == c && c.IsAny("!&|=+-<>?:")) ended = false;
                    if (c == '=' && currToken[0].IsAny("+-/*%!<>")) ended = false;
                    if (c == '>' && currToken[0] == '=') ended = false;
                }
                else if (currToken.Count == 2 && c == '=' && currToken[0].IsAny("&|<>?")) {
                    ended = false;
                }
            }
            else if (c.IsAny(" \t\n\r")) {
                ended = false;
                type = RawTokenKind.None;
            }
            else if (c == '0') type = RawTokenKind.OctalLiteral;
            else if (c.IsDigit()) type = RawTokenKind.DecimalLiteral;
            else if (c.is_alphanumeric() || c == '_') type = RawTokenKind.Identifier;
            else if (c == '/' && i + 1 < raw.Length && raw[i + 1] == '/') comment = true;
            else if (c == '/' && i + 1 < raw.Length && raw[i + 1] == '*') multicomment = true;
            else if (c.IsAny("+-/*%=!&|^(){}[];.,<>!:~?")) type = RawTokenKind.Operator;
            else if (c == '"') type = RawTokenKind.StringLiteral;
            else if (c == '\'') type = RawTokenKind.CharLiteral;
            else throw new MessageException(MessageLevel.Error, "Unrecognized character.", new(filename, line, start, 1, i));

            if (prevType != type && prevType == RawTokenKind.None) {
                currToken.Clear();
                ended = escaping = false;
                start = currStart;
                line = currLine;
                codeStart = i;
            }
            if (ended && type != RawTokenKind.None) {
                if (!repeat) currToken.Add(c);

                AddToken(tokens, currToken, ref type, filename, start, codeStart, line);

                if (repeat) {
                    i--;
                    continue;
                }
            }
            else currToken.Add(c);

            if (c == '\n') {
                currLine++;
                currStart = 0;
            }
            else currStart++;
        }

        if (type == RawTokenKind.StringLiteral) throw new MessageException(MessageLevel.Error, "Unterminated string literal.", new(filename, line, start, 1, raw.Length));
        if (type == RawTokenKind.CharLiteral) throw new MessageException(MessageLevel.Error, "Unterminated char literal.", new(filename, line, start, 1, raw.Length));
        if (type != RawTokenKind.None) AddToken(tokens, currToken, ref type, filename, start, codeStart, line);

        return tokens;
    }
}
