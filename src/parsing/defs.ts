import { RawNode, parseIdentifier, parseInit, parseKeyword, parseOperator } from "./index";
import { Source } from "../utils/Source";
import { ParseResult } from "./ParseResult";
import { VarDeclareNode, parseBody } from "./statement";
import { parseType } from "./types";
import { Node } from "../Node";
import { IterationResult } from "../transforming/TransformerHost";
import { arrcmp } from "../utils/arrcmp";

export class ParamNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
        public readonly type: Node,
    ) { super(loc); }

    public equals(other: Node): boolean {
        return this === other ||
            other instanceof ParamNode &&
            this.name === other.name &&
            Node.equal(this.type, other.type);
    }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const name = parseIdentifier(s, i + n);
        if (name.type !== 'res') return name;
        n += name.n;

        const colon = parseOperator(s, i + n, ":");
        if (colon.type !== 'res') return ParseResult.err("Expected a colon", s.loc(i + n), colon);
        n += colon.n;

        const type = parseType(s, i + n);
        if (type.type !== 'res') return ParseResult.err("Expected a type", s.loc(i + n), type);
        n += type.n;

        return ParseResult.val(new ParamNode(s.loc(loc), name.val, type.val), n);
    }
}
export class FunctionNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
        public readonly params: ParamNode[],
        public readonly body: Node[],
    ) { super(loc); }

    public equals(other: Node): boolean {
        return this === other ||
            other instanceof FunctionNode &&
            this.name === other.name &&
            arrcmp(this.params, other.params, Node.equal);
    }

    public *iterate(): IterationResult {
        const params: ParamNode[] = [];

        for (const param of this.params) {
            for (const el of yield [param]) {
                if (!(el instanceof ParamNode)) return "Parameters may not be transformed to non-parameter nodes";
                params.push(el);
            }
        }

        return [new FunctionNode(this.loc, this.name, params, yield this.body)];
    }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const name = parseIdentifier(s, i + n);
        if (name.type !== 'res') return name;
        n += name.n;

        const open = parseOperator(s, i + n, "(");
        if (open.type !== 'res') return open;
        n += open.n;

        let close = parseOperator(s, i + n, ")");
        n += close.n;

        const params: ParamNode[] = [];

        if (close.type !== 'res') while (true) {
            const paramLoc = i + n;
            const param = ParamNode.parse(s, i + n);
            n += param.n;

            const opLoc = i + n;
            const delim = parseOperator(s, i + n, ",");
            const close = parseOperator(s, i + n, ")");
            n += delim.n;
            n += close.n;

            if (param.type === 'res') params.push(param.val);
            else if (close.type === 'res') break;
            else return ParseResult.err("Expected a parameter", s.loc(paramLoc), param);

            if (close.type === 'res') break;

            if (delim.type !== 'res') return ParseResult.err("Expected a comma or a closing paren", s.loc(opLoc), delim, close);
        }

        const body = parseBody(s, i + n, false);
        if (body.type !== 'res') return ParseResult.err("Expected a function body", s.loc(i + n), body);
        n += body.n;

        return ParseResult.val(new FunctionNode(s.loc(loc), name.val!, params, body.val!), n);
    }
}
export class TypedefNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
        public readonly type?: Node,
    ) { super(loc); }

    public equals(other: Node): boolean {
        return this === other ||
            other instanceof TypedefNode &&
            this.name === other.name &&
            Node.equal(this.type, other.type);
    }

    public *iterate(): IterationResult {
        const res = yield this.type ? [this.type] : [];
        return [...res.slice(0, -1), new TypedefNode(this.loc, this.name, res.at(-1))];
    }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const entry = parseKeyword(s, i + n, "entry");
        if (entry.type !== 'res') return entry;
        n += entry.n;

        const name = parseIdentifier(s, i + n);
        if (name.type !== 'res') return ParseResult.err("Expected a type name", s.loc(i + n), entry);
        n += name.n;

        const assign = parseOperator(s, i + n, "=");
        if (assign.type !== 'res') return ParseResult.err("Expected '='", s.loc(i + n), assign);
        n += assign.n;

        const type = parseType(s, i + n);
        if (type.type !== 'res') return ParseResult.err("Expected a type", s.loc(i + n), type);
        n += type.n;

        return ParseResult.val(new TypedefNode(s.loc(loc), name.val, type.val), n);
    }
}
export class EntrypointNode extends Node {
    public constructor(
        loc: string,
        public readonly body: Node[],
    ) { super(loc); }

    public equals(other: Node): boolean {
        return this === other ||
            other instanceof EntrypointNode &&
            arrcmp(this.body, other.body, Node.equal);
    }

    public *iterate(): IterationResult {
        return [new EntrypointNode(this.loc, yield this.body)];
    }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const entry = parseKeyword(s, i + n, "entry");
        if (entry.type !== 'res') return entry;
        n += entry.n;

        const body = parseBody(s, i + n, true);
        if (body.type !== 'res') return ParseResult.err("Expected an entrypoint body", s.loc(i + n), body);
        n += body.n;

        return ParseResult.val(new EntrypointNode(s.loc(loc), body.val), n);
    }
}

export function parseDefinition(s: Source, i: number) {
    i = parseInit(s, i).loc;

    const raw = RawNode.parse(s, i);
    if (raw.type !== 'fail') return raw;

    const entry = EntrypointNode.parse(s, i);
    if (entry.type !== 'fail') return entry;

    const varDecl = VarDeclareNode.parse(s, i);
    if (varDecl.type !== 'fail') return varDecl;

    const func = FunctionNode.parse(s, i);
    if (func.type !== 'fail') return func;

    return ParseResult.fail;
}
