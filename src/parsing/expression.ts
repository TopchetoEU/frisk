import { Node, RawNode, parseCharLiteral, parseIdentifier, parseInit, parseIntLiteral, parseOperator, parseStringLiteral } from ".";
import { Source } from "../utils/Source";
import { ParseRes } from "./result";

export class AssignNode extends Node {
    public constructor(
        loc: string,
        public readonly obj: Node,
        public readonly val: Node,
    ) { super(loc); }

    public static readonly precedence = 1;

    public static parse(s: Source, i: number, obj?: Node, precedence = 0) {
        if (precedence > this.precedence) return ParseRes.fail;
        let { n, loc } = parseInit(s, i);

        if (obj == null) {
            const res = parseExpression(s, i + n, undefined, this.precedence + 1);
            if (res.failed()) return res;
            n += res.n;
            obj = res.res!;
        }

        const op = parseOperator(s, i + n, "=");
        if (op.failed()) return op;
        n += op.n;

        const val = parseExpression(s, i + n, undefined, this.precedence);
        if (val.failed()) return ParseRes.err("Expected an assignment value", n, val);
        n += val.n;

        return ParseRes.val(new AssignNode(s.toLoc(loc), obj, val.res!), n);
    }
}
export class CallNode extends Node {
    public constructor(
        loc: string,
        public readonly obj: Node,
        public readonly args: Node[],
    ) { super(loc); }

    public static readonly precedence = 39;

    public static parse(s: Source, i: number, obj?: Node, precedence = 0) {
        if (precedence > this.precedence) return ParseRes.fail;
        let { n, loc } = parseInit(s, i);

        if (obj == null) {
            const res = parseExpression(s, i + n, undefined, this.precedence + 1);
            if (res.failed()) return res;
            n += res.n;
            obj = res.res!;
        }

        const open = parseOperator(s, i + n, "(");
        if (open.failed()) return open;
        n += open.n;

        let close = parseOperator(s, i + n, ")");
        n += close.n;

        const args: Node[] = [];

        if (close.failed()) while (true) {
            const arg = parseExpression(s, i + n);
            if (arg.failed()) return ParseRes.err("Expected an argument", i + n, arg);
            n += arg.n;
            args.push(arg.res!);

            const delim = parseOperator(s, i + n, ",");
            n += delim.n;
            const close = parseOperator(s, i + n, ")");
            n += close.n;

            if (delim.failed() && close.failed()) return ParseRes.err("Expected a comma or a closing paren", i + n);
            if (!close.failed()) break;
        }

        return ParseRes.val(new CallNode(s.toLoc(loc), obj, args), n);
    }
}
export class MemberNode extends Node {
    public constructor(
        loc: string,
        public readonly obj: Node,
        public readonly name: string,
    ) { super(loc); }

    public static readonly precedence = 40;

    public static parse(s: Source, i: number, obj?: Node, precedence = 0) {
        if (precedence > this.precedence) return ParseRes.fail;
        let { n, loc } = parseInit(s, i);

        if (obj == null) {
            const res = parseExpression(s, i + n, undefined, this.precedence + 1);
            if (res.failed()) return res;
            n += res.n;
            obj = res.res!;
        }

        const dot = parseOperator(s, i + n, ".");
        if (dot.failed()) return dot;
        n += dot.n;

        const name = parseIdentifier(s, i + n);
        if (name.failed()) return ParseRes.err("Expected a variable name", i + n, name);
        n += name.n;

        return ParseRes.val(new MemberNode(s.toLoc(loc), obj, name.res!), n);
    }
}
export class BinaryOperatorNode extends Node {
    public constructor(
        loc: string,
        public readonly op: string,
        public readonly a: Node,
        public readonly b: Node,
    ) { super(loc); }

    private static _parseOne(s: Source, i: number, obj: Node | undefined, realPrec: number, operator: string, prec: number) {
        if (realPrec > prec) return ParseRes.fail;
        let { n, loc } = parseInit(s, i);

        if (obj == null) {
            const res = parseExpression(s, i + n, undefined, prec + 1);
            if (res.failed()) return res;
            n += res.n;
            obj = res.res!;
        }

        const op = parseOperator(s, i + n, operator);
        if (op.failed()) return op;
        n += op.n;

        const val = parseExpression(s, i + n, undefined, prec);
        if (val.failed()) return ParseRes.err("Expected a value after operator", n, val);
        n += val.n;

        return ParseRes.val(new BinaryOperatorNode(s.toLoc(loc), operator, obj, val.res!), n);
    }

    public static parse(s: Source, i: number, obj?: Node, precedence = 0) {
        const add = this._parseOne(s, i, obj, precedence, "+", 10);
        if (add.hasAny()) return add;
        const sub = this._parseOne(s, i, obj, precedence, '-', 10);
        if (sub.hasAny()) return sub;

        const mult = this._parseOne(s, i, obj, precedence, '*', 11);
        if (mult.hasAny()) return mult;
        const div = this._parseOne(s, i, obj, precedence, '/', 11);
        if (div.hasAny()) return div;
        const mod = this._parseOne(s, i, obj, precedence, '%', 11);
        if (mod.hasAny()) return mod;

        const lt = this._parseOne(s, i, obj, precedence, '<', 5);
        if (lt.hasAny()) return lt;
        const gt = this._parseOne(s, i, obj, precedence, '>', 5);
        if (gt.hasAny()) return gt;
        const lte = this._parseOne(s, i, obj, precedence, '<=', 5);
        if (lte.hasAny()) return lte;
        const gte = this._parseOne(s, i, obj, precedence, '>=', 5);
        if (gte.hasAny()) return gte;

        const eq = this._parseOne(s, i, obj, precedence, '==', 4);
        if (eq.hasAny()) return eq;
        const neq = this._parseOne(s, i, obj, precedence, '!=', 4);
        if (neq.hasAny()) return neq;

        const and = this._parseOne(s, i, obj, precedence, '&&', 3);
        if (and.hasAny()) return and;
        const or = this._parseOne(s, i, obj, precedence, '||', 2);
        if (or.hasAny()) return or;

        return ParseRes.fail;
    }
}
export class VariableNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
    ) { super(loc); }

    public static parse(s: Source, i: number, obj?: Node) {
        if (obj != null) return ParseRes.fail;
        let { n, loc } = parseInit(s, i);

        const res = parseIdentifier(s, i + n);
        if (res.failed()) return res;
        n += res.n;

        return ParseRes.val(new VariableNode(s.toLoc(loc), res.res!), n);
    }
}
export class StringLiteralNode extends Node {
    public constructor(
        loc: string,
        public readonly data: Uint16Array,
    ) { super(loc); }

    public static parse(s: Source, i: number, obj?: Node) {
        if (obj != null) return ParseRes.fail;
        let { n, loc } = parseInit(s, i);

        const data = parseStringLiteral(s, i + n);
        if (data.failed()) return data;
        n += data.n;

        return ParseRes.val(new StringLiteralNode(s.toLoc(loc), new Uint16Array(data.res!)), n);
    }
}
export class IntLiteralNode extends Node {
    public constructor(
        loc: string,
        public readonly data: bigint,
    ) { super(loc); }

    public static parse(s: Source, i: number, obj?: Node) {
        if (obj != null) return ParseRes.fail;
        let { n, loc } = parseInit(s, i);

        const char = parseCharLiteral(s, i + n);
        if (char.hasAny()) return ParseRes.val(new IntLiteralNode(s.toLoc(loc), char.res!), n + char.n);

        const int = parseIntLiteral(s, i + n);
        if (int.hasAny()) return ParseRes.val(new IntLiteralNode(s.toLoc(loc), int.res!), n + int.n);

        return ParseRes.fail;
    }

    public toJS() {
        return `(${this.data}n)`;
    }
}

function _parseParens(s: Source, i: number, obj?: Node) {
    if (obj != null) return ParseRes.fail;
    let { n } = parseInit(s, i);

    const open = parseOperator(s, i + n, "(");
    if (open.failed()) return open;
    n += open.n;

    const res = parseExpression(s, i + n);
    if (res.failed()) return ParseRes.err("Expected expression in parens", i + n, res);
    n += res.n;

    const close = parseOperator(s, i + n, ")");
    if (close.failed()) return ParseRes.err("Expected a closing paren", i + n, close);
    n += close.n;

    return ParseRes.val(res.res!, n);
}
function _parseExpressionPart(s: Source, i: number, obj?: Node, precedence = 0) {
    if (obj == null) {
        const raw = RawNode.parse(s, i);
        if (raw.hasAny()) return raw;
    }

    const paren = _parseParens(s, i, obj);
    if (paren.hasAny()) return paren;

    const str = StringLiteralNode.parse(s, i, obj);
    if (str.hasAny()) return str;

    const int = IntLiteralNode.parse(s, i, obj);
    if (int.hasAny()) return int;

    const assign = AssignNode.parse(s, i, obj, precedence);
    if (assign.hasAny()) return assign;

    const call = CallNode.parse(s, i, obj, precedence);
    if (call.hasAny()) return call;

    const member = MemberNode.parse(s, i, obj, precedence);
    if (member.hasAny()) return member;

    const binary = BinaryOperatorNode.parse(s, i, obj, precedence);
    if (binary.hasAny()) return binary;

    const variable = VariableNode.parse(s, i, obj);
    if (variable.hasAny()) return variable;

    return ParseRes.fail;
}

export function parseExpression(s: Source, i: number, obj?: Node, precedence = 0): ParseRes<Node> {
    let { n, loc } = parseInit(s, i);

    while (true) {
        const res = _parseExpressionPart(s, i + n, obj, precedence);

        n += res.n;
        if (res.hasError()) return res;
        else if (res.failed()) return ParseRes.val(obj!, n);
        else obj = res.res!;
    }
}
