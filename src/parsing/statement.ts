import { Node, NoopNode, parseIdentifier, parseInit, parseKeyword, parseOperator } from ".";
import { Source } from "../utils/Source";
import { parseExpression } from "./expression";
import { ParseRes } from "./result";

export function parseStatement(s: Source, i: number): ParseRes<Node> {
    const _if = IfNode.parse(s, i);
    if (_if.hasAny()) return _if;

    const _while = WhileNode.parse(s, i);
    if (_while.hasAny()) return _while;

    const ret = ReturnNode.parse(s, i);
    if (ret.hasAny()) return ret;

    const varDecl = VarDeclareNode.parse(s, i);
    if (varDecl.hasAny()) return varDecl;

    const comp = CompoundNode.parse(s, i);
    if (comp.hasAny()) return comp;

    const exp = parseExpStatement(s, i);
    if (exp.hasAny()) return exp;

    return ParseRes.fail;
}

export function parseExpStatement(s: Source, i: number) {
    let { n, loc } = parseInit(s, i);

    const exp = parseExpression(s, i + n);
    if (exp.failed()) return exp;
    n += exp.n;

    const semicolon = parseOperator(s, i + n, ";");
    if (semicolon.failed()) return ParseRes.err("Expected a semicolon", i + n, semicolon);
    n += semicolon.n;

    return ParseRes.val(exp.res!, n);
}

export function parseBody(s: Source, i: number, noColon: boolean) {
    let { n, loc } = parseInit(s, i);

    const semicolon = parseOperator(s, i + n, ";");
    if (semicolon.success()) {
        n += semicolon.n;
        return ParseRes.val([], n);
    }

    const brace = parseOperator(s, i + n, "{");
    if (brace.success()) {
        const body = CompoundNode.parse(s, i + n);
        if (body.failed()) return ParseRes.err("Expected a body after '{'", i + n, body);
        n += body.n;

        return ParseRes.val(body.res!.nodes, n);
    }

    const colon = parseOperator(s, i + n, ":");
    if (colon.success() || noColon) {
        n += colon.n;

        const res = parseStatement(s, i + n);
        if (res.failed()) {
            if (!colon.hasError()) return ParseRes.fail;
            else return ParseRes.err("Expected a statement after the colon", i + n, res);
        }
        n += res.n;

        return ParseRes.val([res.res!], n);
    }

    return ParseRes.fail;
}

export class CompoundNode extends Node {
    public constructor(
        loc: string,
        public readonly nodes: Node[]
    ) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);
        const res: Node[] = [];

        const open = parseOperator(s, i + n, "{");
        if (open.failed()) return open;
        n += open.n;

        while (true) {
            const stm = parseStatement(s, i + n);
            n += stm.n;

            const close = parseOperator(s, i + n, "}");
            n += close.n;

            if (stm.failed() && close.failed()) return ParseRes.err("Expected a statement", i + n, stm, close);
            if (stm.success()) res.push(stm.res);
            if (close.success()) break;
        }

        return ParseRes.val(new CompoundNode(s.toLoc(loc), res), n);
    }
}
export class IfNode extends Node {
    public constructor(
        loc: string,
        public readonly cond: Node,
        public readonly ifTrue: Node[],
        public readonly ifFalse: Node[] = [],
    ) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const kw = parseKeyword(s, i + n, "if");
        if (kw.failed()) return kw;
        n += kw.n;

        const cond = parseExpression(s, i + n);
        if (cond.failed()) return ParseRes.err("Expected an if condition", i + n, cond);
        n += cond.n;

        const ifBody = parseBody(s, i + n, false);
        if (ifBody.failed()) return ParseRes.err("Expected an if body", i + n, ifBody);
        n += ifBody.n;

        let elseBody: Node[] = [];

        const elseKw = parseKeyword(s, i + n, "else");
        if (elseKw.success()) {
            n += elseKw.n;

            const body = parseBody(s, i + n, true);
            if (body.failed()) return ParseRes.err("Expected an else body", i + n, body);
            n += body.n;

            elseBody = body.res!;
        }

        return ParseRes.val(new IfNode(s.toLoc(loc), cond.res!, ifBody.res!, elseBody), n);
    }
}
export class WhileNode extends Node {
    public constructor(
        loc: string,
        public readonly cond?: Node,
        public readonly beforeBody: Node[] = [],
        public readonly afterBody: Node[] = [],
    ) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        let before: Node[] | undefined;
        let after: Node[] | undefined;
        let cond: Node | undefined;
        let any = false;

        const doKw = parseKeyword(s, i + n, "do");
        if (doKw.success()) {
            n += doKw.n;
            any = true;

            const body = parseBody(s, i + n, true);
            if (body.failed()) return ParseRes.err("Expected a loop prebody", i + n, body);
            n += body.n;

            before = body.res;
        }

        const whileKw = parseKeyword(s, i + n, "while");
        if (whileKw.success()) {
            n += whileKw.n;
            any = true;

            const condRes = parseExpression(s, i + n);
            if (condRes.failed()) return ParseRes.err("Expected a loop condition", i + n, condRes);
            n += condRes.n;

            cond = condRes.res;

            const body = parseBody(s, i + n, false);
            if (body.failed()) return ParseRes.err("Expected a loop postbody", i + n, body);
            n += body.n;

            after = body.res;
        }

        if (!any) return ParseRes.fail;

        return ParseRes.val(new WhileNode(s.toLoc(loc), cond, before, after), n);
    }
}
export class ReturnNode extends Node {
    public constructor(
        loc: string,
        public readonly val?: Node,
    ) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const kw = parseKeyword(s, i + n, "return");
        if (kw.failed()) return kw;
        n += kw.n;

        const val = parseExpression(s, i + n);
        n += val.n;

        const semicolon = parseOperator(s, i + n, ";");
        if (semicolon.failed()) return ParseRes.err("Expected a semicolon", i + n, semicolon);
        n += semicolon.n;

        return ParseRes.val(new ReturnNode(s.toLoc(loc), val.res), n);
    }
}

export class VarDeclareNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
        public readonly mutable: boolean,
        public readonly initValue?: Node,
    ) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const letKw = parseKeyword(s, i + n, "let");
        const constKw = parseKeyword(s, i + n, "const");

        n += letKw.n;
        n += constKw.n;

        if (letKw.failed() && constKw.failed()) return ParseRes.fail;
        const mutable = letKw.success();

        const name = parseIdentifier(s, i + n);
        if (name.failed()) return ParseRes.err("Expeced a variable name", i + n, name);
        n += name.n;

        let init: Node | undefined;

        const assign = parseOperator(s, i + n, "=");
        if (assign.success()) {
            n += assign.n;

            const initRes = parseExpression(s, i + n);
            if (initRes.failed()) return ParseRes.err("Expected an expression after '='", i + n, initRes);
            n += initRes.n;

            init = initRes.res!;
        }
        else if (!mutable) return ParseRes.err("Expected an initializer for constant", i + n, assign);

        const semicolon = parseOperator(s, i + n, ";");
        if (semicolon.failed()) return ParseRes.err("Expected a semicolon", i + n, semicolon);
        n += semicolon.n;

        return ParseRes.val(new VarDeclareNode(s.toLoc(loc), name.res!, mutable, init), n);
    }
}