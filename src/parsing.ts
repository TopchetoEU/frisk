import { ParseResult } from "./ParseResult";
import { Int, Obj, Str, Value } from "./runtime";
import { Source } from "./Source";

export function skipWhite(s: Source, i: number) {
    let n = 0;
    let commentState: undefined | "one_slash" | "single" | "multi_first" | "multi" | "end";

    while (true) {
        const c = s.at(i + n);
        if (c == null) break;

        if (commentState === "one_slash") {
            if (c === "/") commentState = "single";
            else if (c === "*") commentState = "multi";
            else return n - 1;
        }
        else if (commentState === "single") {
            if (c === "\n") commentState = "end";
        }
        else if (commentState === "multi") {
            if (c === "*") commentState = "multi_first";
        }
        else if (commentState === "multi_first") {
            if (c === "/") commentState = "end";
            else if (c != "*") commentState = "multi";
        }
        else if (c === "/") commentState = "one_slash";

        if (commentState === undefined && c !== " " && c !== "\n" && c !== "\t") return n;
        if (commentState === "end") commentState = undefined;

        n++;
    }

    return n;
}
export function parseInit(s: Source, i: number) {
    const n = skipWhite(s, i);

    return { n, loc: i + n };
}

export function parseKeyword(s: Source, i: number, kw?: string) {
    let { n } = parseInit(s, i);
    let res = "";

    while (true) {
        const c = s.at(i + n);

        if (c == null) break;
        if (!c.match(/[\w\d_]/g)) break;

        res += c;
        n++;
    }

    if (res.length == 0) return ParseResult.fail;

    if (kw != null) {
        if (kw != res) return ParseResult.fail;
        else return ParseResult.val(res, n);
    }
    else return ParseResult.val(res, n);
}
export function parseOperator(s: Source, i: number, op: string) {
    let { n } = parseInit(s, i);

    for (let j = 0; j < op.length; j++, n++) {
        if (s.at(i + n) != op[j]) return ParseResult.fail;
    }

    return ParseResult.val(op, n);
}
export function parseIdentifier(s: Source, i: number) {
    let { n } = parseInit(s, i);
    const loc = i + n;

    const first = parseKeyword(s, i + n);
    if (first[0] !== "res") return first;
    n += first[1];

    let res = first[2];

    while (true) {
        const colons = parseOperator(s, i + n, "::");
        if (colons[0] !== "res") break;
        n += colons[1];
        res += "::";

        const word = parseKeyword(s, i + n);
        if (word[0] !== "res") return ParseResult.err("Expected an identifier after '::'", s.loc(i + n), word);
        n += word[1];
        res += word[2];
    }

    const underI = res.indexOf("___");
    if (underI >= 0) return ParseResult.err("Too many sequential underscores", s.loc(loc + underI));
    else return ParseResult.val(res, n);
}

export function parseIntLiteral(s: Source, i: number, max?: number) {
    function parseSingle(n: number, radix: bigint, radixn: number) {
        let res = 0n;

        while (true) {
            const digit = Number.parseInt(s.at(i + n) ?? "", radixn);
            if (isNaN(digit)) break;
            const digitb = BigInt(digit);
            if (max != null && res * radix + BigInt(digitb) >= max) break;

            res = res * radix + digitb;
            n++;
        }

        if (n === 0) return ParseResult.fail;
        else return ParseResult.val(res, n);
    }

    let { n } = parseInit(s, i);

    const start = s.at(i + n);
    if (start === "0") {
        const type = s.at(i + n + 1);
        if (type === "x") {
            const res = parseSingle(n + 2, 16n, 16);
            if (res[0] !== "res") return ParseResult.err("Expected a hexadecimal number", s.loc(i + n + 2), res);
            return res;
        }
        else if (type === "o") {
            const res = parseSingle(n + 2, 8n, 8);
            if (res[0] !== "res") return ParseResult.err("Expected an octal number", s.loc(i + n + 2), res);
            return res;
        }
        else if (type === "b") {
            const res = parseSingle(n + 2, 2n, 2);
            if (res[0] !== "res") return ParseResult.err("Expected a binary number", s.loc(i + n + 2), res);
            return res;
        }
    }

    return parseSingle(n, 10n, 10);
}
export function parseChar(s: Source, i: number) {
    let c = s.at(i);
    if (c == null) return ParseResult.fail;

    if (c == "\\") {
        let n = 1;
        c = s.at(i + n);
        if (c == null) return ParseResult.err("Expected a character", s.loc(i + n));

        if (c === "t") return ParseResult.val(BigInt("\t".charCodeAt(0)), 2);
        if (c === "n") return ParseResult.val(BigInt("\n".charCodeAt(0)), 2);
        if (c === "v") return ParseResult.val(BigInt("\v".charCodeAt(0)), 2);
        if (c === "f") return ParseResult.val(BigInt("\f".charCodeAt(0)), 2);
        if (c === "r") return ParseResult.val(BigInt("\r".charCodeAt(0)), 2);
        if (c === "e") return ParseResult.val(BigInt("\e".charCodeAt(0)), 2);
        if (/[0-9]/.test(c)) {
            const res = parseIntLiteral(s, i + n, 65536);
            if (res[0] !== "res") return res;
            return ParseResult.val(res[2]!, res[1]);
        }

        return ParseResult.val(BigInt(c.charCodeAt(0)), 2);
    }
    else return ParseResult.val(BigInt(c.charCodeAt(0)), 1);
}
export function parseStringLiteral(s: Source, i: number) {
    let { n } = parseInit(s, i);

    const open = parseOperator(s, i + n, "\"");
    if (open[0] !== "res") return open;
    n += open[1];

    const res: number[] = [];

    while (true) {
        const curr = s.at(i + n);
        if (curr == null) return ParseResult.err("Unterminated string literal", s.loc(i + n));
        if (curr == "\"") break;

        const char = parseChar(s, i + n);
        if (char[0] !== "res") return char;
        n = n + char[1];

        res.push(Number(char[2]!));
    }
    n = n + 1;

    return ParseResult.val(res, n);
}
export function parseCharLiteral(s: Source, i: number) {
    let { n } = parseInit(s, i);

    const open = parseOperator(s, i + n, "'");
    if (open[0] !== "res") return open;
    n += open[1];

    let res = 0n;

    while (true) {
        const curr = s.at(i + n);
        if (curr == null) return ParseResult.err("Unterminated char literal", s.loc(i + n));
        if (curr == "'") break;

        const char = parseChar(s, i + n);
        if (char[0] !== "res") return char;
        n += char[1];

        let data = char[2]!;

        do {
            res <<= 8n;
            res |= data & 0xFFn;
            data >>= 8n;
        } while (data !== 0n);
    }
    n++;

    return ParseResult.val(res, n);
}

export interface Operator {
    parser(s: Source, i: number, parser: ExpressionParser): ParseResult<(...args: Value[]) => Value>;
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
                if (res[0] === "fail") return res;
                n += res[1];

                return ParseResult.val((...args) => [ "call", name, ...args ], n);
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
                if (res[0] === "fail") return res;
                n += res[1];

                const b = p.parse(s, i + n, precedence);
                if (b[0] !== "res") return b;
                n += b[1];

                const res2 = parseOperator(s, i + n, tokenB);
                if (res2[0] === "fail") return res2;
                n += res2[1];

                return ParseResult.val((a, c) => [ "call", name, a, b[2], c ], n);
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
                if (op[0] === "fail") return op;
                n += op[1];

                const identifier = parseIdentifier(s, i);
                if (identifier[0] !== "res") return identifier;
                n += identifier[1];

                return ParseResult.val(a => ["call", name, a], n);
            },
            precedence,
            sortI: token.length,
        } satisfies Operator;
    }
    export function call(name: string | undefined, open: string, close: string, delim: string, argPrecedence: number, precedence: number) {
        return {
            parser: (s, i, p) => {
                let { n, loc } = parseInit(s, i);

                const openRes = parseOperator(s, i + n, open);
                if (openRes[0] !== "res") return openRes;
                n += openRes[1];

                let closeRes = parseOperator(s, i + n, close);
                n += closeRes[1];

                const args: Value[] = [];

                if (closeRes[0] !== "res") while (true) {
                    const arg = p.parse(s, i + n, argPrecedence);
                    if (arg[0] !== "res") return ParseResult.err("Expected an argument", s.loc(i + n), arg);
                    n += arg[1];
                    args.push(arg[2]);

                    const delimRes = parseOperator(s, i + n, delim);
                    n += delimRes[1];
                    const closeRes = parseOperator(s, i + n, close);
                    n += closeRes[1];

                    if (delimRes[0] !== "res" && closeRes[0] !== "res") return ParseResult.err("Expected a comma or a closing paren", s.loc(i + n));
                    if (closeRes[0] === "res") break;
                }

                return ParseResult.val(func => name == null ? ["call", func, ...args] : ["call", name, func, ...args], n);
            },
            precedence,
            sortI: token.length,
        } satisfies Operator;
    }
}

interface OperatorInstance {
    packager(...args: Value[]): Value;
    precedence: number;
    associative?: boolean;
    n: number;
    loc: string;
}
function OperatorInstance(op: Operator, argsN: number, loc: string, packager: (...args: Value[]) => Value): OperatorInstance {
    return {
        precedence: op.precedence,
        associative: op.associative,
        loc, n: argsN, packager,
    };
}

export class ExpressionParser {
    public static readonly default = new ExpressionParser(
        [
            Operator.token("op::neg", "-", 14),
            Operator.token("op::pos", "+", 14),
            Operator.token("op::flip", "~", 14),
            Operator.token("op::inc_prefix", "++", 14),
            Operator.token("op::dec_prefix", "--", 14),
        ],
        [
            Operator.token("op::inc_postfix", "++", 15),
            Operator.token("op::dec_postfix", "--", 15),
            Operator.member("member::obj", ".", 15),
            Operator.member("member::ptr", "->", 15),
            Operator.call("invoke", "(", ")", ",", 0, 15),
            Operator.call("index", "[", "]", ",", 0, 15),
            Operator.call(undefined, "#(", ")", ",", 0, 15),
        ],
        [
            Operator.token("op::mult", "*", 13),
            Operator.token("op::div", "/", 13),
            Operator.token("op::mod", "%", 13),

            Operator.token("op::add", "+", 12),
            Operator.token("op::sub", "-", 12),

            Operator.token("op::shift_left", "<<", 11),
            Operator.token("op::shift_right", ">>", 11),

            Operator.token("op::lt", "<", 10),
            Operator.token("op::gt", ">", 10),
            Operator.token("op::lte", "<=", 10),
            Operator.token("op::gte", ">=", 10),

            Operator.token("op::eq", "==", 9),
            Operator.token("op::neq", "!=", 9),

            Operator.token("op::and", "&", 8),
            Operator.token("op::xor", "^", 7),
            Operator.token("op::or", "|", 6),

            Operator.token("logical::and", "&&", 5),
            Operator.token("logical::or", "||", 4),

            // Operator.trinary("op::trinary", "?", ":", 3, true),

            Operator.token("op::assign", "=", 2, true),
        ],
        [
            (s, i, p) => {
                let { n } = parseInit(s, i);

                const open = parseOperator(s, i + n, "(");
                if (open[0] !== "res") return open;
                n += open[1];

                const res = p.parse(s, i + n);
                if (res[0] !== "res") return ParseResult.err("Expected expression in parens", s.loc(i + n), res);
                n += res[1];

                const close = parseOperator(s, i + n, ")");
                if (close[0] !== "res") return ParseResult.err("Expected a closing paren", s.loc(i + n), close);
                n += close[1];

                return ParseResult.val(res[2], n);
            },
            (s, i, p) => {
                let { n } = parseInit(s, i);

                const open = parseOperator(s, i + n, "#(");
                if (open[0] !== "res") return open;
                n += open[1];

                const res = p.parse(s, i + n);
                if (res[0] !== "res") return ParseResult.err("Expected expression in parens", s.loc(i + n), res);
                n += res[1];

                const close = parseOperator(s, i + n, ")");
                if (close[0] !== "res") return ParseResult.err("Expected a closing paren", s.loc(i + n), close);
                n += close[1];

                return ParseResult.val(["call", "capsule", res[2]], n);
            },
            (s, i, p) => {
                let { n, loc } = parseInit(s, i);
                const res: Value[] = [];

                const open = parseOperator(s, i + n, "{");
                if (open[0] !== "res") return open;
                n += open[1];

                while (true) {
                    const stm = p.parse(s, i + n);
                    let stmI = i + n;
                    n += stm[1];

                    const end = parseOperator(s, i + n, ";");
                    let endI = i + n;
                    n += end[1];

                    const close = parseOperator(s, i + n, "}");
                    n += close[1];

                    if (stm[0] !== "res" && close[0] !== "res") return ParseResult.err("Expected a statement", s.loc(stmI), stm, close);
                    if (stm[0] === "res") res.push(stm[2]);
                    if (end[0] !== "res") return ParseResult.err("Expected a semicolon", s.loc(endI));
                    if (close[0] === "res") break;
                }

                return ParseResult.val([ "call", "op::comp", ...res ], n);
            },
            (s, i, p) => {
                let { n, loc } = parseInit(s, i);
                const res: Value[] = [];

                const open = parseOperator(s, i + n, "[");
                if (open[0] !== "res") return open;
                n += open[1];

                while (true) {
                    const stm = p.parse(s, i + n);
                    let stmI = i + n;
                    n += stm[1];

                    const end = parseOperator(s, i + n, ",");
                    n += end[1];
                    const close = parseOperator(s, i + n, "]");
                    n += close[1];

                    if (stm[0] !== "res" && close[0] !== "res") return ParseResult.err("Expected a statement", s.loc(stmI), stm, close);
                    if (stm[0] === "res") res.push(stm[2]);
                    if (close[0] === "res") break;
                    if (end[0] !== "res") return ParseResult.err("Expected a semicolon", s.loc(n + i));
                }

                return ParseResult.val(["call", "new", "list", ...res], n);
            },
            (s, i, p) => {
                let { n, loc } = parseInit(s, i);
                const res: Value[] = [];

                const type = parseIdentifier(s, i + n);
                if (type[0] !== "res") return type;
                n += type[1];

                const open = parseOperator(s, i + n, "{");
                if (open[0] !== "res") return open;
                n += open[1];

                while (true) {
                    const stm = p.parse(s, i + n);
                    let stmI = i + n;
                    n += stm[1];

                    const end = parseOperator(s, i + n, ",");
                    n += end[1];
                    const close = parseOperator(s, i + n, "}");
                    n += close[1];

                    if (stm[0] !== "res" && close[0] !== "res") return ParseResult.err("Expected a statement", s.loc(stmI), stm, close);
                    if (stm[0] === "res") res.push(stm[2]);
                    if (close[0] === "res") break;
                    if (end[0] !== "res") return ParseResult.err("Expected a semicolon", s.loc(n + i));
                }

                return ParseResult.val(["call", "new", type[2], ...res], n);
            },
            (s, i): ParseResult<Str> => {
                let { n } = parseInit(s, i);

                const data = parseStringLiteral(s, i + n);
                if (data[0] !== "res") return data;
                n += data[1];

                return ParseResult.val(String.fromCharCode(...data[2]), n);
            },
            (s, i): ParseResult<Int> => {
                let { n, loc } = parseInit(s, i);
        
                const char = parseCharLiteral(s, i + n);
                if (char[0] === "err") return char;
                if (char[0] === "res") return ParseResult.val(char[2], n + char[1]);
        
                const int = parseIntLiteral(s, i + n);
                if (int[0] === "err") return char;
                if (int[0] === "res") return ParseResult.val(int[2], n + int[1]);
        
                return ParseResult.fail;
            },
            (s, i): ParseResult<Value> => {
                let { n } = parseInit(s, i);

                const res = parseIdentifier(s, i + n);
                if (res[0] !== "res") return res;
                n += res[1];

                return ParseResult.val(["call", "get", res[2]], n);
            }
        ]
    );

    public parse(s: Source, i: number, precedence = 0): ParseResult<Value> {
        let { n } = parseInit(s, i);

        const stack: OperatorInstance[] = [];
        const operands: Value[] = [];


        function popOp() {
            const args: Value[] = [];
            const op = stack.pop();
            if (op == null) return;

            for (let i = op.n; i > 0; i--) {
                const arg = operands.pop();
                if (arg == null) return ParseResult.err(`Operand ${i} missing`, op.loc);
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
                    if (opRes[0] === "fail") continue;
                    if (opRes[0] === "err") return opRes;
                    n += opRes[1];

                    stack.push(OperatorInstance(currOp, 1, opLoc, opRes[2]));
                    continue prefix;
                }
                break;
            }

            for (const part of this.parts) {
                const res = part(s, i + n, this);
                if (res[0] === "err") return res;
                if (res[0] === "fail") continue;
                operands.push(res[2]);
                n += res[1];
                break;
            }

            postfix: while (true) {
                for (const currOp of this.postfix) {
                    if (currOp.precedence < precedence) continue;

                    n += skipWhite(s, i + n);
                    const opLoc = s.loc(i + n);

                    const opRes = currOp.parser(s, i + n, this);
                    if (opRes[0] === "fail") continue;
                    if (opRes[0] === "err") return opRes;
                    n += opRes[1];

                    const res = pushOp(OperatorInstance(currOp, 1, opLoc, opRes[2])) || popOp();
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
                if (opRes[0] === "fail") continue;
                if (opRes[0] === "err") return opRes;
                n += opRes[1];

                const res = pushOp(OperatorInstance(currOp, 2, opLoc, opRes[2]));
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

        if (res == null) return ParseResult.fail;
        else return ParseResult.val(res, n);
    }

    public constructor(
        public readonly prefix: Operator[],
        public readonly postfix: Operator[],
        public readonly infix: Operator[],
        public readonly parts: ((s: Source, i: number, p: ExpressionParser) => ParseResult<Value>)[],
    ) {
        this.infix.sort((a, b) => b.sortI - a.sortI);
        this.prefix.sort((a, b) => b.sortI - a.sortI);
        this.postfix.sort((a, b) => b.sortI - a.sortI);
    }

    public static parseFile(src: Source) {
        const res: Value[] = [];
        const parser = ExpressionParser.default;
        let i = 0;

        while (true) {
            i += skipWhite(src, i);
            if (i >= src.source.length) break;

            const exp = parser.parse(src, i);
            i += exp[1];

            const semicolon = parseOperator(src, i, ";");
            i += semicolon[1];

            if (exp[0] === "err") return exp;
            else if (exp[0] === "fail") return ParseResult.err("Unexpected syntax", src.loc(i));
            else if (semicolon[0] !== "res") return ParseResult.err("Expected a semicolon", src.loc(i), semicolon);
            else res.push(exp[2]!);
        }

        return ParseResult.val(res, i);
    }
    public static parseFiles(...files: Source[]) {
        const nodes: Value[] = [];
        const errors: string[] = [];

        for (const file of files) {
            const res = ExpressionParser.parseFile(file);

            if (res[0] === "res")  nodes.push(...res[2]);
            else if (res[0] === "err") errors.push(`${res[2]}: ${res[3]}`);
            else errors.push(`${file}: Failed to compile`);
        }

        if (errors.length > 0) throw new Error(errors.join("\n"));
        else return nodes;
    }
}

export function compile(...sources: Source[]): Obj<"call"> {
    const res = ExpressionParser.parseFiles(...sources);
    return ["call", "op::comp", ...res];
}