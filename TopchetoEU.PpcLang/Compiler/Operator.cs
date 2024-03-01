namespace TopchetoEU.PpcLang.Compiler;

public enum Operator {
    NONE,

    LessThan,
    GreaterThan,
    LessThanEquals,
    GreaterThanEquals,
    Equals,
    NotEquals,
    DoubleAnd,
    DoubleOr,

    ShiftLeft,
    ShiftRight,
    Xor,
    And,
    Or,
    Bang,
    DoubleBang,
    BitwiseNot,

    Increase,
    Decrease,

    Add,
    Subtract,
    Divide,
    Multiply,
    Modulo,

    Question,

    Assign,
    AssignAdd,
    AssignSubtract,
    AssignMultiply,
    AssignDivide,
    AssignModulo,
    AssignShiftLeft,
    AssignShiftRight,
    AssignXor,
    AssignAnd,
    AssignOr,
    AssignDoubleAnd,
    AssignDoubleOr,

    PTR_MEMBER,
    DOT,
    Comma,
    Semicolon,
    Colon,
    DoubleColon,
        
    LAMBDA,
        
    BRACKET_OPEN,
    BRACKET_CLOSE,
    BRACE_OPEN,
    BRACE_CLOSE,
    ParenOpen,
    ParenClose,
};
