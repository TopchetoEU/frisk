import { Message } from "../utils/Message.ts";
import { Namespace } from "../utils/Namespace.ts";
import { Operator } from "../utils/Operator.ts";
import { Consumer } from "./Consumer.ts";
import { Node } from "./Node.ts";
import { AsmNode, ParseResult, parseDelimList } from "./common.ts";
import { errLoc } from "./common.ts";
import { parseIdentifier } from "./common.ts";

export function parseExpression(c: Consumer, i: number, obj?: Node, precedence = 0): ParseResult<Node> {
    let n = 0;

    while (true) {
        const res = ParseResult.first<Node>(
            () => AsmNode.parse(c, i + n),
            () => StringLiteralNode.parse(c, i + n, obj),
            () => IntLiteralNode.parse(c, i + n, obj),
            () => ObjectLiteralNode.parse(c, i + n, obj),
            () => parseParens(c, i + n, obj),
            () => AssignNode.parse(c, i + n, obj, precedence),
            () => CallNode.parse(c, i + n, obj, precedence),
            () => MemberNode.parse(c, i + n, obj, precedence),
            () => BinaryOperatorNode.parse(c, i + n, obj, precedence),
            () => VariableNode.parse(c, i + n, obj),
        );

        n += res.n;
        if (res.msg) return res.error();
        else if (res.failed) return ParseResult.res(obj!, n);
        else obj = res.val!;
    }
}

export function parseParens(c: Consumer, i: number, obj?: Node) {
    if (obj != null) return ParseResult.fail;
    let n = 0;

    if (!c.get(i + n++)?.isOperator(Operator.ParenOpen)) return ParseResult.fail;

    const res = parseExpression(c, i + n);
    if (res.failed) return res.error(new Message("Expected expression in parens", errLoc(c, i, n)));
    n += res.n;

    if (!c.get(i + n)?.isOperator(Operator.ParenClose)) return ParseResult.error(new Message("Expected closing paren", errLoc(c, i, n)));
    n++;

    return ParseResult.res(res.val!, n);
}

export class AssignNode implements Node {
    public constructor(
        public readonly obj: Node,
        public readonly val: Node,
    ) { }

    public static readonly precedence = 1;

    public static parse(c: Consumer, i: number, obj?: Node, precedence = 0) {
        if (precedence > this.precedence) return ParseResult.fail;
        let n = 0;

        if (obj == null) {
            const res = parseExpression(c, i + n, undefined, this.precedence + 1);
            if (res.failed) return res.error();
            n += res.n;
            obj = res.val!;
        }

        if (!c.get(i + n)?.isOperator(Operator.Assign)) return ParseResult.fail;
        n++;

        const val = parseExpression(c, i + n, undefined, this.precedence);
        n += val.n;

        if (val.failed) return val.error(new Message("Expected an assignment value", errLoc(c, i + n)));
        else return ParseResult.res(new AssignNode(obj, val.val!), n);
    }

    public toJS() {
        return `(${this.obj.toJS()} = ${this.val.toJS()})`;
    }
}
export class CallNode implements Node {
    public constructor(
        public readonly obj: Node,
        public readonly args: Node[],
    ) { }

    public static readonly precedence = 39;

    public static parse(c: Consumer, i: number, obj?: Node, precedence = 0) {
        if (precedence > this.precedence) return ParseResult.fail;
        let n = 0;

        if (obj == null) {
            const res = parseExpression(c, i + n, undefined, this.precedence + 1);
            if (res.failed) return res.error();
            n += res.n;
            obj = res.val!;
        }

        const args = parseDelimList(c, i + n,
            Operator.ParenOpen, Operator.ParenClose, Operator.Comma,
            'argument', (c, i) => parseExpression(c, i)
        );

        if (args.failed) return args.error();
        n += args.n;

        return ParseResult.res(new CallNode(obj, args.val!), n);
    }

    public toJS() {
        return `(${this.obj.toJS()}(${this.args.map(v => v.toJS()).join(',')}))`;
    }
}
export class MemberNode implements Node {
    public constructor(
        public readonly obj: Node,
        public readonly name: Namespace,
    ) { }

    public static readonly precedence = 40;

    public static parse(c: Consumer, i: number, obj?: Node, precedence = 0) {
        if (precedence > this.precedence) return ParseResult.fail;
        let n = 0;

        if (obj == null) {
            const res = parseExpression(c, i + n, undefined, this.precedence + 1);
            if (res.failed) return res.error();
            n += res.n;
            obj = res.val!;
        }

        if (!c.get(i + n)?.isOperator(Operator.Dot)) return ParseResult.fail;
        n++;

        const res = parseIdentifier(c, i + n);
        n += res.n;

        if (res.failed) return res.error(new Message("Expected a variable name", errLoc(c, i + n)));
        else return ParseResult.res(new MemberNode(obj, res.val!), n);
    }

    public toJS() {
        return `(${this.obj.toJS()}.${this.name.join('$$')})`;
    }
}
export class BinaryOperatorNode implements Node {
    public constructor(
        public readonly op: string,
        public readonly a: Node,
        public readonly b: Node,
    ) { }

    public static readonly ops: { op: Operator, prec: number, js: string }[] = [
        { op: Operator.Add, prec: 10, js: '+' },
        { op: Operator.Subtract, prec: 10, js: '-' },

        { op: Operator.Multiply, prec: 11, js: '*' },
        { op: Operator.Divide, prec: 11, js: '/' },
        { op: Operator.Modulo, prec: 11, js: '%' },

        { op: Operator.LessThan, prec: 5, js: '<' },
        { op: Operator.GreaterThan, prec: 5, js: '>' },
        { op: Operator.LessThanEquals, prec: 5, js: '<=' },
        { op: Operator.GreaterThanEquals, prec: 5, js: '>=' },

        { op: Operator.Equals, prec: 4, js: '===' },
        { op: Operator.NotEquals, prec: 4, js: '!==' },

        { op: Operator.And, prec: 3, js: '&&' },
        { op: Operator.Or, prec: 2, js: '||' },
    ]

    public static parse(c: Consumer, i: number, obj?: Node, precedence = 0) {
        const opPrec = this.ops.find(v => v.op == c.get(i)?.operator);
        if (opPrec == null || obj == null) return ParseResult.fail;
        if (precedence > opPrec.prec) return ParseResult.fail;

        const { js, prec } = opPrec;
        let n = 1;

        const other = parseExpression(c, i + n, undefined, prec + 1);
        if (other.failed) return other.error(new Message("Expected a second value", errLoc(c, i + n)));
        n += other.n;

        return ParseResult.res(new BinaryOperatorNode(js, obj, other.val!), n);
    }

    public toJS() {
        return `(${this.a.toJS()}${this.op}${this.b.toJS()})`;
    }
}
export class VariableNode implements Node {
    public constructor(
        public readonly name: Namespace,
    ) { }

    public static parse(c: Consumer, i: number, obj?: Node) {
        if (obj != null) return ParseResult.fail;

        const res = parseIdentifier(c, i);
        if (res.failed) return res.error();
        else return ParseResult.res(new VariableNode(res.val!), res.n);
    }

    public toJS() {
        return `($$${this.name.join('$$')})`;
    }
}
export class StringLiteralNode implements Node {
    public constructor(
        public readonly data: Uint16Array,
    ) { }

    public static parse(c: Consumer, i: number, obj?: Node) {
        if (obj != null) return ParseResult.fail;

        const tok = c.get(i);
        if (!tok?.stringLiteral) return ParseResult.fail;
        else return ParseResult.res(new StringLiteralNode(tok.stringLiteral), 1);
    }

    public toJS() {
        return `('${[ ...this.data ]
            .map(v => v.toString(16))
            .map(v => {
                while (v.length < 4) v = '0' + v;
                return v;
            })
            .map(v => '\\u' + v)
            .join('')}')`;
    }
}
export class IntLiteralNode implements Node {
    public constructor(
        public readonly data: bigint,
    ) { }

    public static parse(c: Consumer, i: number, obj?: Node) {
        if (obj != null) return ParseResult.fail;

        const tok = c.get(i);
        if (tok?.intLiteral != null) return ParseResult.res(new IntLiteralNode(tok.intLiteral), 1);
        if (tok?.charLiteral != null) return ParseResult.res(new IntLiteralNode(tok.charLiteral), 1);
        return ParseResult.fail;
    }

    public toJS() {
        return `(${this.data}n)`;
    }
}
export class ObjectLiteralNode implements Node {
    public constructor(
        public readonly values: Record<string, Node>,
    ) { }

    public static parse(c: Consumer, i: number, obj?: Node) {
        if (obj != null) return ParseResult.fail;

        return parseDelimList(c, i,
            Operator.BraceOpen, Operator.BraceClose, Operator.Comma,
            'key-value pair', (c, i) => {
                let n = 0;

                const name = parseIdentifier(c, i);
                if (name.failed) return name.error(new Message("Expected a key"));
                n += name.n;

                if (!c.get(i + n)?.isOperator(Operator.Colon)) return ParseResult.error(new Message("Expected a colon after key"));
                n++;

                const value = parseExpression(c, i + n);
                if (value.failed) return name.error(new Message("Expected a key"));
                n += value.n;

                return ParseResult.res(<[string, Node]>[ name.val!.toString(), value.val! ], n);
            }
        ).map((v) => new ObjectLiteralNode(Object.fromEntries(v)));
    }

    public toJS() {
        return `({${Object.entries(this.values).map(([k, v]) => `${k.replace('::', '$$')}: ${v.toJS()}`)}})`;
    }
}
