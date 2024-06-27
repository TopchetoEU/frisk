import { NoopNode, parseIdentifier, parseInit, parseKeyword, parseOperator } from ".";
import { Node } from "../Node";
import { Source } from "../utils/Source";
import { ExpressionParser } from "./expression";
import { Result } from "./result";

export class CompoundNode extends Node {
    public constructor(
        loc: string,
        public readonly nodes: Node[]
    ) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);
        const res: Node[] = [];

        const open = parseOperator(s, i + n, "{");
        if (open.type !== 'res') return open;
        n += open.n;

        while (true) {
            const stm = parseStatement(s, i + n);
            n += stm.n;

            const close = parseOperator(s, i + n, "}");
            n += close.n;

            if (stm.type !== 'res' && close.type !== 'res') return Result.err("Expected a statement", s.loc(i + n), stm, close);
            if (stm.type === 'res') res.push(stm.val);
            if (close.type === 'res') break;
        }

        return Result.val(new CompoundNode(s.loc(loc), res), n);
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
        if (kw.type !== 'res') return kw;
        n += kw.n;

        const cond = ExpressionParser.default.parse(s, i + n);
        if (cond.type !== 'res') return Result.err("Expected an if condition", s.loc(i + n), cond);
        n += cond.n;

        const ifBody = parseBody(s, i + n, false);
        if (ifBody.type !== 'res') return Result.err("Expected an if body", s.loc(i + n), ifBody);
        n += ifBody.n;

        let elseBody: Node[] = [];

        const elseKw = parseKeyword(s, i + n, "else");
        if (elseKw.type === 'res') {
            n += elseKw.n;

            const body = parseBody(s, i + n, true);
            if (body.type !== 'res') return Result.err("Expected an else body", s.loc(i + n), body);
            n += body.n;

            elseBody = body.val!;
        }

        return Result.val(new IfNode(s.loc(loc), cond.val!, ifBody.val!, elseBody), n);
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
        if (doKw.type === 'res') {
            n += doKw.n;
            any = true;

            const body = parseBody(s, i + n, true);
            if (body.type !== 'res') return Result.err("Expected a loop prebody", s.loc(i + n), body);
            n += body.n;

            before = body.val;
        }

        const whileKw = parseKeyword(s, i + n, "while");
        if (whileKw.type === 'res') {
            n += whileKw.n;
            any = true;

            const condRes = ExpressionParser.default.parse(s, i + n);
            if (condRes.type !== 'res') return Result.err("Expected a loop condition", s.loc(i + n), condRes);
            n += condRes.n;

            cond = condRes.val;

            const body = parseBody(s, i + n, false);
            if (body.type !== 'res') return Result.err("Expected a loop postbody", s.loc(i + n), body);
            n += body.n;

            after = body.val;
        }

        if (!any) return Result.fail;

        return Result.val(new WhileNode(s.loc(loc), cond, before, after), n);
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
        if (kw.type !== 'res') return kw;
        n += kw.n;

        const val = ExpressionParser.default.parse(s, i + n);
        n += val.n;

        const semicolon = parseOperator(s, i + n, ";");
        if (semicolon.type !== 'res') return Result.err("Expected a semicolon", s.loc(i + n), semicolon);
        n += semicolon.n;

        return Result.val(new ReturnNode(s.loc(loc), val.type === 'res' ? val.val : undefined), n);
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

        if (letKw.type !== 'res' && constKw.type !== 'res') return Result.fail;
        const mutable = letKw.type === 'res';

        const name = parseIdentifier(s, i + n);
        if (name.type !== 'res') return Result.err("Expeced a variable name", s.loc(i + n), name);
        n += name.n;

        let init: Node | undefined;

        const assign = parseOperator(s, i + n, "=");
        if (assign.type === 'res') {
            n += assign.n;

            const initRes = ExpressionParser.default.parse(s, i + n);
            if (initRes.type !== 'res') return Result.err("Expected an expression after '='", s.loc(i + n), initRes);
            n += initRes.n;

            init = initRes.val!;
        }
        else if (!mutable) return Result.err("Expected an initializer for constant", s.loc(i + n), assign);

        const semicolon = parseOperator(s, i + n, ";");
        if (semicolon.type !== 'res') return Result.err("Expected a semicolon", s.loc(i + n), semicolon);
        n += semicolon.n;

        return Result.val(new VarDeclareNode(s.loc(loc), name.val!, mutable, init), n);
    }
}

export function parseStatement(s: Source, i: number): Result<Node> {
    const noop = NoopNode.parse(s, i);
    if (noop.type !== 'fail') return noop;

    const _if = IfNode.parse(s, i);
    if (_if.type !== 'fail') return _if;

    const _while = WhileNode.parse(s, i);
    if (_while.type !== 'fail') return _while;

    const ret = ReturnNode.parse(s, i);
    if (ret.type !== 'fail') return ret;

    const varDecl = VarDeclareNode.parse(s, i);
    if (varDecl.type !== 'fail') return varDecl;

    const comp = CompoundNode.parse(s, i);
    if (comp.type !== 'fail') return comp;

    const exp = parseExpStatement(s, i);
    if (exp.type !== 'fail') return exp;

    return Result.fail;
}

export function parseExpStatement(s: Source, i: number) {
    let { n, loc } = parseInit(s, i);

    const exp = ExpressionParser.default.parse(s, i + n);
    if (exp.type !== 'res') return exp;
    n += exp.n;

    const semicolon = parseOperator(s, i + n, ";");
    if (semicolon.type !== 'res') return Result.err("Expected a semicolon", s.loc(i + n), semicolon);
    n += semicolon.n;

    return Result.val(exp.val!, n);
}

export function parseBody(s: Source, i: number, noColon: boolean) {
    let { n, loc } = parseInit(s, i);

    const semicolon = parseOperator(s, i + n, ";");
    if (semicolon.type === 'res') {
        n += semicolon.n;
        return Result.val([], n);
    }

    const brace = parseOperator(s, i + n, "{");
    if (brace.type === 'res') {
        const body = CompoundNode.parse(s, i + n);
        if (body.type !== 'res') return Result.err("Expected a body after '{'", s.loc(i + n), body);
        n += body.n;

        return Result.val(body.val!.nodes, n);
    }

    const colon = parseOperator(s, i + n, ":");
    if (colon.type === 'res' || noColon) {
        n += colon.n;

        const res = parseStatement(s, i + n);
        if (res.type !== 'res') return Result.err("Expected a statement after the colon", s.loc(i + n), res);
        n += res.n;

        return Result.val([res.val], n);
    }

    return Result.fail;
}