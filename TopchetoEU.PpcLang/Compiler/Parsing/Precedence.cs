namespace TopchetoEU.PpcLang.Compiler.Parsing.Definitions;

public enum Precedence {
    All,
    Assignment,
    Ternary,
    LazyOr,
    LazyAnd,
    Or,
    Xor,
    And,
    Equality,
    Comparasion,
    Shift,
    Additive,
    Multiplicative,
    Prefix,
    Variable,
    None,
}
