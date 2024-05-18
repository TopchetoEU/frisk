import { Node, RawNode, parseIdentifier, parseInit, parseKeyword, parseOperator } from "./index";
import { Source } from "../utils/Source";
import { ParseRes } from "./result";
import { VarDeclareNode, parseBody } from "./statement";

export function parseDefinition(s: Source, i: number) {
    i = parseInit(s, i).loc;

    const raw = RawNode.parse(s, i);
    if (raw.hasAny()) return raw;

    const entry = EntrypointNode.parse(s, i);
    if (entry.hasAny()) return entry;

    const varDecl = VarDeclareNode.parse(s, i);
    if (varDecl.hasAny()) return varDecl;

    const func = FunctionNode.parse(s, i);
    if (func.hasAny()) return func;

    return ParseRes.fail;
}

export class FunctionNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
        public readonly params: string[],
        public readonly body: Node[],
    ) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const name = parseIdentifier(s, i + n);
        if (name.failed()) return name;
        n += name.n;

        const open = parseOperator(s, i + n, "(");
        if (open.failed()) return open;
        n += open.n;

        let close = parseOperator(s, i + n, ")");
        n += close.n;

        const params: string[] = [];

        if (close.failed()) while (true) {
            const argLoc = i + n;
            const param = parseIdentifier(s, i + n);
            n += param.n;

            const opLoc = i + n;
            const delim = parseOperator(s, i + n, ",");
            const close = parseOperator(s, i + n, ")");
            n += delim.n;
            n += close.n;

            if (param.success()) params.push(param.res);
            else if (close.success()) break;
            else return ParseRes.err("Expected a parameter", argLoc, param);

            if (close.success()) break;

            if (delim.failed()) return ParseRes.err("Expected a comma or a closing paren", opLoc, delim, close);
        }

        const body = parseBody(s, i + n, false);
        if (body.failed()) return ParseRes.err("Expected a function body", i + n, body);
        n += body.n;

        return ParseRes.val(new FunctionNode(s.toLoc(loc), name.res!, params, body.res!), n);
    }
}
export class EntrypointNode extends Node {
    public constructor(
        loc: string,
        public readonly body: Node[],
    ) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const entry = parseKeyword(s, i + n, "entry");
        if (entry.failed()) return entry;
        n += entry.n;

        const body = parseBody(s, i + n, true);
        if (body.failed()) return ParseRes.err("Expected an entrypoint body", i + n, body);
        n += body.n;

        return ParseRes.val(new EntrypointNode(s.toLoc(loc), []), n);
    }
}
