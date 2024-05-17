export enum Operator {
    None,

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
    BitwiseNot,

    Increase,
    Decrease,

    Add,
    Subtract,
    Divide,
    Multiply,
    Modulo,

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

    Dot,
    Comma,
    Semicolon,
    Colon,
    DoubleColon,

    BracketOpen,
    BracketClose,
    BraceOpen,
    BraceClose,
    ParenOpen,
    ParenClose,
}
// deno-lint-ignore no-namespace
export namespace Operator {
    const ops = [
        null,
        "<", ">", "<=", ">=", "==", "!=", "&&", "||",
        "<<", ">>", "^", "&", "|", "!", "~",
        "++", "--",
        "+", "-", "/", "*", "%",
        "=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", "^=", "&=", "|=", "&&=", "||=",
        ".", ",", ";", ":", "::",
        "[", "]", "{", "}", "(", ")"
    ];
    const readableOps = [
        "(none)",
        "less than", "greater than", "less than or equals", "greater than or equals", "equals", "not equals", "double ampersand", "double pipe",
        "double less than", "double greater than", "caret", "ampersand", "pipe", "bang", "tilde",
        "increment", "decrement",
        "plus", "minus", "slash", "star", "percent",

        "equals", "add assign", "subtract assign", "multiply assign", "divide assign", "modulo assign",
        "lefy shift assign", "right shift assign",
        "xor assign", "and assign", "or assign", "lazy and assign", "lazy or assign",

        "dot", "comma", "semicolon", "colon", "double colon",
        "open bracket", "close bracket", "open brace", "close brace", "open paren", "close paren"
    ];

    export function find(raw: string) {
        const res = ops.indexOf(raw);
        if (res < 1) return Operator.None;
        else return <Operator>res;
    }
    export function stringify(op: Operator) {
        return readableOps[op];
    }
}

