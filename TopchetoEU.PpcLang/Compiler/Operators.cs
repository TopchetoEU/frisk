namespace TopchetoEU.PpcLang.Compiler;

public static class Operators {
    private static List<string> ops = new() {
        "(none)",
        "<", ">", "<=", ">=", "==", "!=", "&&", "||",
        "<<", ">>", "^", "&", "|", "!", "!!", "~",
        "++", "--",
        "+", "-", "/", "*", "%",
        "?",
        "=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", "^=", "&=", "|=", "&&=", "||=",
        "->", ".", ",", ";", ":", "::",
        "=>",
        "[", "]", "{", "}", "(", ")"
    };
    private static List<string> readableOps = new() {
        "(none)",
        "less than", "greater than", "less than or equals", "greater than or equals", "equals", "not equals", "double ampersand", "double pipe",
        "double less than", "double greater than", "caret", "ampersand", "pipe", "bang", "double bang", "tilde",
        "increment", "decrement",
        "plus", "minus", "slash", "star", "percent",
        "question mark",

        "equals", "add assign", "subtract assign", "multiply assign", "divide assign", "modulo assign",
        "lefy shift assign", "right shift assign",
        "xor assign", "and assign", "or assign", "lazy and assign", "lazy or assign",
        
        "member arrow", "dot", "comma", "semicolon", "colon", "double colon",
        "function arrow",
        "open bracket", "close bracket", "open brace", "close brace", "open paren", "close paren"
    };
    public static Operator Find(string val) {
        var i = ops.IndexOf(val);
        if (i < 1)
            return Operator.NONE;
        else
            return (Operator)i;
    }
    public static string Readable(this Operator kw, bool words = false) => words ? readableOps[(int)kw] : ops[(int)kw];
    public static bool IsAny(this Operator kw, params Operator[] ops) => ops.Contains(kw);
}
