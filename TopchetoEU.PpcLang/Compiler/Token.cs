using System.Data;
using System.Numerics;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler;

public readonly struct Token {
    private readonly object? data = null;
    public TokenKind Kind { get; }
    public Location Location { get; }

    public bool IsIdentifier => Kind == TokenKind.Identifier;
    public bool IsOperator => Kind == TokenKind.Operator;
    public bool IsIntLiteral => Kind == TokenKind.IntLiteral;
    public bool IsStringLiteral => Kind == TokenKind.StringLiteral;

    public string Identifier {
        get {
            if (!IsIdentifier) throw new InvalidOperationException("Token is not an identifier.");
            else return (string)data!;
        }
    }
    public Operator Operator {
        get {
            if (!IsOperator) throw new InvalidOperationException("Token is not an operator.");
            else return (Operator)data!;
        }
    }
    public byte[] StringLiteral {
        get {
            if (!IsIntLiteral) throw new InvalidOperationException("Token is not a literal.");
            else return (byte[])data!;
        }
    }
    public BigInteger IntLiteral {
        get {
            if (!IsIntLiteral)
                throw new InvalidOperationException("Token is not a literal.");
            else
                return (BigInteger)data!;
        }
    }

    public bool TestOperator(Operator op) => IsOperator && Operator == op;
    public bool TestIdentifier(string val) => IsIdentifier && Identifier == val;

    public override string ToString() {
        if (data is byte[] arr) return $"{Kind}: \"{new string(arr.Select(v => (char)v).ToArray())}\"";
        return $"{Kind}: {data}";
    }

    public Token(Location? loc = null) { Kind = TokenKind.None; Location = loc ?? Location.None; }
    public Token(string identifier, Location? loc = null) {
        Kind = TokenKind.Identifier;
        data = identifier;
        Location = loc ?? Location.None;
    }
    public Token(Operator op, Location? loc = null) {
        Kind = TokenKind.Operator;
        data = op;
        Location = loc ?? Location.None;
    }
    public Token(BigInteger val, Location? loc = null) {
        Kind = TokenKind.IntLiteral;
        data = val;
        Location = loc ?? Location.None;
    }
    public Token(byte[] val, Location? loc = null) {
        Kind = TokenKind.StringLiteral;
        data = new byte[val.Length];
        Location = loc ?? Location.None;
        val.CopyTo((byte[])data, 0);
    }
    public Token(Token tok) {
        data = tok.data;
        Location = tok.Location;
        Kind = tok.Kind;
    }
    
    public static byte[] ParseString(MsgStack msgStack, bool is_char, RawToken token) {
        char literal_char = is_char ? '\'' : '"';

        bool escaping = false;

        var res = new List<byte>();
        var start = token.location.Start + 1;
        var codestart = token.location.CodeStart + 1;
        var line = token.location.Line;

        for (int i = 1; i < token.data.Length; i++) {
            var c = token.data[i];

            if (escaping) {
                char new_c;

                if (c == 'b') new_c = '\b';
                else if (c == 'a') new_c = '\a';
                else if (c == 'e') new_c = '\x1B';
                else if (c == 'f') new_c = '\f';
                else if (c == 'n') new_c = '\n';
                else if (c == 'r') new_c = '\r';
                else if (c == 't') new_c = '\t';
                else if (c == 'v') new_c = '\v';
                else if (c.IsOctal()) {
                    new_c = '\0';
                    int n = 0;
                    while (c.IsOctal()) {
                        new_c <<= 3;
                        new_c |= (char)(c - '0');
                        c = token.data[++i];
                        n++;
                    }
                    if (n > 3) {
                        codestart--;
                        start--;
                        msgStack.Warn("Octal escape sequence overflows 255 8-bit limit (3 digits).", new(line, start, n - 1, codestart));
                    }
                    start += n - 1;
                    codestart += n - 1;
                    i--;
                }
                else if (c.IsHex()) {
                    new_c = '\0';
                    int n = 0;
                    while (c.IsHex()) {
                        new_c <<= 4;
                        if (c.IsLower()) new_c |= (char)(c - 'a' + 9);
                        if (c.IsUpper()) new_c |= (char)(c - 'A' + 9);
                        if (c.IsDigit()) new_c |= (char)(c - '0');
                        c = token.data[++i];
                        n++;
                    }
                    if (n > 2) {
                        codestart--;
                        start--;
                        msgStack.Warn("Hex escape sequence overflows 255 8-bit limit (2 digits).", new(line, start, n - 1, codestart));
                    }
                    start += n - 1;
                    codestart += n - 1;
                    i--;
                }
                else if (c == literal_char || c == '\\') new_c = c;
                else {
                    throw new MessageException(MessageLevel.Error, "Unescapable character.", new(line, start, 1, codestart));
                }
                res.Add((byte)new_c);
                escaping = false;
            }
            else {
                if (c == '\\') escaping = true;
                else if (c == literal_char) return res.ToArray();
                else res.Add((byte)c);
            }

            start++;
            codestart++;
            if (c == '\n') break;
        }

        if (is_char) throw new MessageException(MessageLevel.Error, "Unterminated char literal.", token.location);
        else throw new MessageException(MessageLevel.Error, "Unterminated string literal.", token.location);
    }
    
    public static BigInteger ParseBin(int i, string data) {
        var res = new BigInteger();

        for (int j = i; j < data.Length; j++) {
            res <<= 1;
            res |= data[j] - '0';
        }

        return res;
    }
    public static BigInteger ParseHex(int i, string data) {
        var res = new BigInteger();

        for (int j = i; j < data.Length; j++) {
            res <<= 4;
            if (data[j].IsLower()) res |= data[j] - 'a' + 9;
            if (data[j].IsUpper()) res |= data[j] - 'A' + 9;
            if (data[j].IsDigit()) res |= data[j] - '0';
        }

        return res;
    }
    public static BigInteger ParseOct(int i, string data) {
        var res = new BigInteger();

        for (int j = i; j < data.Length; j++) {
            res <<= 3;
            res |= data[j] - '0';
        }

        return res;
    }
    public static BigInteger ParseDec(int i, string data) {
        var res = new BigInteger();

        for (int j = i; j < data.Length; j++) {
            res *= 10;
            res += data[j] - '0';
        }

        return res;
    }
    
    public static byte[] ParseFloat(MsgStack msgStack, int i, string data) => throw new NotImplementedException();
    
    public static Token Parse(MsgStack messages, RawToken raw) {
        if (raw.Kind == RawTokenKind.Operator) {
            var op = Operators.Find(raw.data);
            if (op == Operator.NONE) throw new MessageException(MessageLevel.Error, "Operator not recognised.", raw.location);
            else return new(op, raw.location);
        }

        return raw.Kind switch {
            RawTokenKind.Identifier => new(raw.data, raw.location),
            RawTokenKind.BinaryLiteral => new(ParseBin(2, raw.data), raw.location),
            RawTokenKind.OctalLiteral => new(ParseOct(1, raw.data), raw.location),
            RawTokenKind.DecimalLiteral => new(ParseDec(0, raw.data), raw.location),
            RawTokenKind.HexLiteral => new(ParseHex(2, raw.data), raw.location),
            RawTokenKind.FloatLiteral => new(ParseFloat(messages, 0, raw.data), raw.location),
            RawTokenKind.StringLiteral => new(ParseString(messages, false, raw), raw.location),
            RawTokenKind.CharLiteral => new(ParseString(messages, true, raw), raw.location),
            _ => throw new MessageException(MessageLevel.Error, "Token type not recognised.", raw.location),
        };
    }
    public static IEnumerable<Token> ParseMany(MsgStack msgStack, IEnumerable<RawToken> tokens) => tokens.Select(v => Parse(msgStack, v));
    public static IEnumerable<Token> ParseMany(MsgStack msgStack, string filename, string raw) => ParseMany(msgStack, RawToken.ParseMany(filename, raw));
}
