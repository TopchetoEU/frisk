namespace TopchetoEU.PpcLang.Compiler;

public enum RawTokenKind {
    None,
    Identifier,
    Operator,
    BinaryLiteral,
    OctalLiteral,
    DecimalLiteral,
    HexLiteral,
    FloatLiteral,
    StringLiteral,
    CharLiteral,
}
