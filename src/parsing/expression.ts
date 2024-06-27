import { parseCharLiteral, parseIdentifier, parseInit, parseIntLiteral, parseOperator, parseStringLiteral, skipWhite } from ".";
import { Node } from "../Node";
import { Source } from "../utils/Source";
import { Result } from "./result";

export class VariableNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
    ) { super(loc); }

    public static parse(s: Source, i: number, obj?: Node) {
        if (obj != null) return Result.fail;
        let { n, loc } = parseInit(s, i);

        const res = parseIdentifier(s, i + n);
        if (res.type !== 'res') return res;
        n += res.n;

        return Result.val(new VariableNode(s.loc(loc), res.val!), n);
    }
}
export class StringLiteralNode extends Node {
    public constructor(
        loc: string,
        public readonly data: Uint16Array,
    ) { super(loc); }

    public static parse(s: Source, i: number, obj?: Node) {
        if (obj != null) return Result.fail;
        let { n, loc } = parseInit(s, i);

        const data = parseStringLiteral(s, i + n);
        if (data.type !== 'res') return data;
        n += data.n;

        return Result.val(new StringLiteralNode(s.loc(loc), new Uint16Array(data.val!)), n);
    }
}
export class IntLiteralNode extends Node {
    public constructor(
        loc: string,
        public readonly data: bigint,
    ) { super(loc); }

    public static parse(s: Source, i: number, obj?: Node) {
        if (obj != null) return Result.fail;
        let { n, loc } = parseInit(s, i);

        const char = parseCharLiteral(s, i + n);
        if (char.type === 'err') return char;
        if (char.type === 'res') return Result.val(new IntLiteralNode(s.loc(loc), char.val), n + char.n);

        const int = parseIntLiteral(s, i + n);
        if (int.type === 'err') return char;
        if (int.type === 'res') return Result.val(new IntLiteralNode(s.loc(loc), int.val), n + int.n);

        return Result.fail;
    }

    public toJS() {
        return `(${this.data}n)`;
    }
}
export class OperatorNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
        public readonly operands: Node[],
    ) { super(loc); }
}
export class MemberNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
        public readonly obj: Node,
        public readonly member: string,
    ) { super(loc); }
}
export class CallNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
        public readonly obj: Node,
        public readonly args: Node[],
    ) { super(loc); }

}

export interface Operator {
    parser(s: Source, i: number, parser: ExpressionParser): Result<(...args: Node[]) => Node>;
    precedence: number;
    sortI: number;
    associative?: boolean;
}
export namespace Operator {
    export function token(name: string, token: string, precedence: number, associative = false) {
        return {
            parser: (s, i) => {
                let { n, loc } = parseInit(s, i);

                const res = parseOperator(s, i + n, token);
                if (res.type === 'fail') return res;
                n += res.n;

                return Result.val((...args) => new OperatorNode(s.loc(loc), name, args), n);
            },
            precedence,
            associative,
            sortI: token.length,
        } satisfies Operator;
    }
    export function trinary(name: string, tokenA: string, tokenB: string, precedence: number, associative = false) {
        return {
            parser: (s, i, p) => {
                let { n, loc } = parseInit(s, i);

                const res = parseOperator(s, i + n, tokenA);
                if (res.type === 'fail') return res;
                n += res.n;

                const b = p.parse(s, i + n, precedence);
                if (b.type !== 'res') return b;
                n += b.n;

                return Result.val((...[a, c]) => new OperatorNode(s.loc(loc), name, [a, b.val, c]), n);
            },
            precedence,
            associative,
            sortI: token.length,
        } satisfies Operator;
    }
    export function member(name: string, token: string, precedence: number) {
        return {
            parser: (s, i) => {
                let { n, loc } = parseInit(s, i);

                const op = parseOperator(s, i, token);
                if (op.type === 'fail') return op;
                n += op.n;

                const identifier = parseIdentifier(s, i);
                if (identifier.type !== 'res') return identifier;
                n += identifier.n;

                return Result.val((...args) => new MemberNode(s.loc(loc), name, args[0], identifier.val), n);
            },
            precedence,
            sortI: token.length,
        } satisfies Operator;
    }
    export function call(name: string, open: string, close: string, delim: string, argPrecedence: number, precedence: number) {
        return {
            parser: (s, i, p) => {
                let { n, loc } = parseInit(s, i);

                const openRes = parseOperator(s, i + n, open);
                if (openRes.type !== 'res') return openRes;
                n += openRes.n;

                let closeRes = parseOperator(s, i + n, close);
                n += closeRes.n;

                const args: Node[] = [];

                if (closeRes.type !== 'res') while (true) {
                    const arg = p.parse(s, i + n, argPrecedence);
                    if (arg.type !== 'res') return Result.err("Expected an argument", s.loc(i + n), arg);
                    n += arg.n;
                    args.push(arg.val);

                    const delimRes = parseOperator(s, i + n, delim);
                    n += delimRes.n;
                    const closeRes = parseOperator(s, i + n, close);
                    n += closeRes.n;

                    if (delimRes.type !== 'res' && closeRes.type !== 'res') return Result.err("Expected a comma or a closing paren", s.loc(i + n));
                    if (closeRes.type === 'res') break;
                }

                return Result.val((...ops) => new CallNode(s.loc(loc), name, ops[0], args), n);
            },
            precedence,
            sortI: token.length,
        } satisfies Operator;
    }
}

interface OperatorInstance {
    packager(...args: Node[]): Node;
    precedence: number;
    associative?: boolean;
    n: number;
    loc: string;
}
function OperatorInstance(op: Operator, n: number, loc: string, packager: (...args: Node[]) => Node): OperatorInstance {
    return {
        precedence: op.precedence,
        associative: op.associative,
        loc, n, packager,
    };
}

export class ExpressionParser {
    public static readonly default = new ExpressionParser(
        [
            Operator.token('op::neg', '-', 14),
            Operator.token('op::pos', '+', 14),
            Operator.token('op::flip', '~', 14),
            Operator.token('op::inc_prefix', '++', 14),
            Operator.token('op::dec_prefix', '--', 14),
        ],
        [
            Operator.token('op::inc_postfix', '++', 15),
            Operator.token('op::dec_postfix', '--', 15),
            Operator.member('member::obj', '.', 15),
            Operator.member('member::ptr', '->', 15),
            Operator.call('call', '(', ')', ',', 0, 15),
            Operator.call('index', '[', ']', ',', 0, 15),
        ],
        [
            Operator.token('op::mult', '*', 13),
            Operator.token('op::div', '/', 13),
            Operator.token('op::mod', '%', 13),

            Operator.token('op::add', '+', 12),
            Operator.token('op::sub', '-', 12),

            Operator.token('op::shift_left', '<<', 11),
            Operator.token('op::shift_right', '>>', 11),

            Operator.token('op::lt', '<', 10),
            Operator.token('op::gt', '>', 10),
            Operator.token('op::lte', '<=', 10),
            Operator.token('op::gte', '>=', 10),

            Operator.token('op::eq', '==', 9),
            Operator.token('op::neq', '!=', 9),

            Operator.token('op::and', '&', 8),
            Operator.token('op::xor', '^', 7),
            Operator.token('op::or', '|', 6),

            Operator.token('logical::and', '&&', 5),
            Operator.token('logical::or', '||', 4),

            Operator.trinary('op::trinary', '?', ':', 3, true),

            Operator.token('op::assign', '=', 2, true),
        ],
        [
            (s, i, p) => {
                let { n } = parseInit(s, i);

                const open = parseOperator(s, i + n, "(");
                if (open.type !== 'res') return open;
                n += open.n;

                const res = p.parse(s, i + n);
                if (res.type !== 'res') return Result.err("Expected expression in parens", s.loc(i + n), res);
                n += res.n;

                const close = parseOperator(s, i + n, ")");
                if (close.type !== 'res') return Result.err("Expected a closing paren", s.loc(i + n), close);
                n += close.n;

                return Result.val(res.val!, n);
            },
            (s, i) => StringLiteralNode.parse(s, i),
            (s, i) => IntLiteralNode.parse(s, i),
            (s, i) => VariableNode.parse(s, i),
        ]
    );

    public constructor(
        public readonly prefix: Operator[],
        public readonly postfix: Operator[],
        public readonly infix: Operator[],
        public readonly parts: ((s: Source, i: number, p: ExpressionParser) => Result<Node>)[],
    ) {
        this.infix.sort((a, b) => b.sortI - a.sortI);
        this.prefix.sort((a, b) => b.sortI - a.sortI);
        this.postfix.sort((a, b) => b.sortI - a.sortI);
    }

    private _parsePart(s: Source, i: number) {
        for (const part of this.parts) {
            const res = part(s, i, this);
            if (res.type === 'err') return res;
            if (res.type === 'fail') continue;
            return res;
        }

        return Result.fail;
    }

    public parse(s: Source, i: number, precedence = 0): Result<Node> {
        let { n } = parseInit(s, i);

        const stack: OperatorInstance[] = [];
        const operands: Node[] = [];


        function popOp() {
            const args: Node[] = [];
            const op = stack.pop();
            if (op == null) return;

            for (let i = op.n; i > 0; i--) {
                const arg = operands.pop();
                if (arg == null) return Result.err(`Operand ${i} missing`, op.loc);
                args[i - 1] = arg;
            }

            operands.push(op.packager(...args));
        }

        function pushOp(op: OperatorInstance) {
            while (true) {
                const cmpOp = stack.at(-1);
                if (cmpOp == null) break;

                if (op.associative && cmpOp.precedence <= op.precedence) break;
                if (!op.associative && cmpOp.precedence < op.precedence) break;

                const pushRes = popOp();
                if (pushRes != null) return pushRes;
            }

            stack.push(op);
        }

        loop: while (true) {
            prefix: while (true) {
                for (const currOp of this.prefix) {
                    if (currOp.precedence < precedence) continue;

                    n += skipWhite(s, i + n);
                    const opLoc = s.loc(i + n);

                    const opRes = currOp.parser(s, i + n, this);
                    if (opRes.type === 'fail') continue;
                    if (opRes.type === 'err') return opRes;
                    n += opRes.n;

                    stack.push(OperatorInstance(currOp, 1, opLoc, opRes.val));
                    continue prefix;
                }
                break;
            }

            for (const part of this.parts) {
                const res = part(s, i + n, this);
                if (res.type === 'err') return res;
                if (res.type === 'fail') continue;
                operands.push(res.val);
                n += res.n;
                break;
            }

            postfix: while (true) {
                for (const currOp of this.postfix) {
                    if (currOp.precedence < precedence) continue;

                    n += skipWhite(s, i + n);
                    const opLoc = s.loc(i + n);

                    const opRes = currOp.parser(s, i + n, this);
                    if (opRes.type === 'fail') continue;
                    if (opRes.type === 'err') return opRes;
                    n += opRes.n;

                    const res = pushOp(OperatorInstance(currOp, 1, opLoc, opRes.val)) || popOp();
                    if (res) return res;

                    continue postfix;
                }
                break;
            }

            for (const currOp of this.infix) {
                if (currOp.precedence < precedence) continue;

                n += skipWhite(s, i + n);
                const opLoc = s.loc(i + n);

                const opRes = currOp.parser(s, i + n, this);
                if (opRes.type === 'fail') continue;
                if (opRes.type === 'err') return opRes;
                n += opRes.n;

                const res = pushOp(OperatorInstance(currOp, 2, opLoc, opRes.val));
                if (res) return res;
                continue loop;
            }

            break;
        }

        while (stack.length) {
            const pushRes = popOp();
            if (pushRes != null) return pushRes;
        }

        const res = operands.pop()!;

        if (res == null) return Result.fail;
        else return Result.val(res, n);
    }
}