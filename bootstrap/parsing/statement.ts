import { Message } from "../utils/Message.ts";
import { Namespace } from "../utils/Namespace.ts";
import { Operator } from "../utils/Operator.ts";
import { Consumer } from "./Consumer.ts";
import { Node } from "./Node.ts";
import { ParseResult, errLoc, loc, parseIdentifier } from "./common.ts";
import { parseExpression } from "./expression.ts";

export function parseStatement(c: Consumer, i: number): ParseResult<Node> {
    let res = ParseResult.first<Node>(
        () => IfNode.parse(c, i),
        () => WhileNode.parse(c, i),
        () => CompoundNode.parse(c, i),
        () => {
            if (c.get(i)?.isOperator(Operator.Semicolon)) return ParseResult.res(new CompoundNode([]), 1);
            else return ParseResult.fail;
        }
    );

    if (res.succeeded || res.msg) return res;

    res = ParseResult.first<Node>(
        () => ReturnNode.parse(c, i),
        () => VarDeclareNode.parse(c, i),
        () => parseExpression(c, i),
    );

    if (res.failed) return res.error();
    else if (c.get(i + res.n)?.isOperator(Operator.Semicolon)) return ParseResult.res(res.val!, res.n + 1);
    else return res.error(new Message("Expected a semicolon after statement", errLoc(c, i, res.n)));
}

export function parseBody(c: Consumer, i: number) {
    switch (c.get(i)?.operator) {
        case Operator.Colon: {
            let n = 1;
            const res = parseStatement(c, i + n);
            if (res.failed) return res.error(new Message("Expected a statement after the colon", errLoc(c, i, n)));
            n += res.n;

            return ParseResult.res([ res.val! ], n);
        }
        case Operator.BraceOpen: {
            const res = CompoundNode.parse(c, i);
            if (res.failed) return res.error();
            else return ParseResult.res(res.val!.nodes, res.n);
        }
        case Operator.Semicolon:
            return ParseResult.res([ ], 1);
        default:
            return ParseResult.error(new Message("Expected a compound statement or a single-line body"));
    }
}

export class CompoundNode implements Node {
    public constructor(public readonly nodes: Node[]) { }

    public toJS() {
        return `{${this.nodes.map(v => v.toJS()).join(';')}}`;
    }

    public static parse(c: Consumer, i: number) {
        let n = 0;

        const res: Node[] = [];

        if (!c.get(i + n)?.isOperator(Operator.BraceOpen)) return ParseResult.fail;
        if (!c.get(i + n + 1)?.isOperator(Operator.BraceClose)) {
            n++;

            while (true) {
                const exp = parseStatement(c, i + n);
                if (exp.failed) {
                    if (exp.msg != null) {
                        if (res.length === 0) return exp.error(new Message(`Expected a statement or a closing brace`, loc(c, i + n)));
                        else return exp.error(new Message(`Expected a statement`, loc(c, i + n)));
                    }
                    else if (c.get(i + n)?.isOperator(Operator.BraceClose)) break;
                    else return ParseResult.error(new Message(`Expected a ${Operator.stringify(Operator.BraceClose)}`, errLoc(c, i, n)));
                }
                else res.push(exp.val!);
                n += exp.n;
    
                if (c.get(i + n)?.isOperator(Operator.BraceClose)) break;
                else continue;
            }
        }
        else n++;

        return ParseResult.res(new CompoundNode(res), n + 1);
    }
}
export class IfNode implements Node {
    public constructor(
        public readonly cond: Node,
        public readonly ifTrue: Node[],
        public readonly ifFalse: Node[] = [],
    ) { }

    public toJS() {
        return `if(${this.cond.toJS()}){${this.ifTrue.map(v => v.toJS()).join(';')}}else{${this.ifFalse.map(v => v.toJS()).join(';')}}`;
    }

    public static parse(c: Consumer, i: number): ParseResult<IfNode> {
        let n = 0;

        if (!c.get(i + n)?.isIdentifier("if")) return ParseResult.fail;
        n++;

        const cond = parseExpression(c, i + n);
        if (cond.failed) return cond.error(new Message("Expected an if condition", errLoc(c, i, n)));
        n += cond.n;

        const ifBody = parseBody(c, i + n);
        if (ifBody.failed) return ifBody.error(new Message("Expected an if body", errLoc(c, i, n)));
        n += ifBody.n;

        let elseBody: ParseResult<Node[]> | undefined;

        if (c.get(i + n)?.isIdentifier("else")) {
            n++;
            if (c.get(i + n)?.isIdentifier("if")) elseBody = IfNode.parse(c, i + n).map(v => [v]);
            else elseBody = parseBody(c, i + n);

            if (elseBody?.failed) return elseBody.error(new Message("Expected an else body", errLoc(c, i, n)));
            n += elseBody.n;
        }

        return ParseResult.res(new IfNode(cond.val!, ifBody.val!, elseBody?.val!), n);
    }
}
export class WhileNode implements Node {
    public constructor(
        public readonly cond?: Node,
        public readonly beforeBody: Node[] = [],
        public readonly afterBody: Node[] = [],
    ) { }

    public toJS() {
        return `for(;;){${this.beforeBody.map(v => v.toJS()).join(';')};if(!${this.cond?.toJS() ?? 'true'})break;${this.afterBody.map(v => v.toJS()).join(';')}}`;
    }

    public static parse(c: Consumer, i: number) {
        let n = 0;

        let before: ParseResult<Node[]> | undefined;
        let after: ParseResult<Node[]> | undefined;
        let cond: ParseResult<Node> | undefined;

        if (c.get(i + n)?.isIdentifier("do")) {
            n++;

            before = parseBody(c, i + n);
            if (before.failed) return before.error(new Message("Expected a do body", errLoc(c, i, n)));
            n += before.n;
        }

        if (c.get(i + n)?.isIdentifier("while")) {
            n++;

            cond = parseExpression(c, i + n);
            if (cond.failed) return cond.error(new Message("Expected a while condition", errLoc(c, i, n)));
            n += cond.n;

            after = parseBody(c, i + n);
            if (after.failed) return after.error(new Message("Expected a while body", errLoc(c, i, n)));
            n += after.n;
        }

        if (before == null && after == null) return ParseResult.fail;

        return ParseResult.res(new WhileNode(cond?.val, before?.val, after?.val), n);
    }
}
export class ReturnNode implements Node {
    public constructor(
        public readonly val?: Node,
    ) { }

    public toJS() {
        return `return ${this.val?.toJS()}`;
    }

    public static parse(c: Consumer, i: number) {
        if (!c.get(i)?.isIdentifier("return")) return ParseResult.fail;
        let n = 1;

        const val = parseExpression(c, i + n);
        if (val.msg) return val.error();
        n += val.n;

        return ParseResult.res(new ReturnNode(val.val), n);
    }
}

export class VarDeclareNode implements Node {
    public constructor(
        public readonly name: Namespace,
        public readonly mutable: boolean,
        public readonly initValue?: Node,
    ) { }

    public toJS() {
        if (this.mutable) return `let $$${this.name.join('$$')} = ${this.initValue?.toJS() ?? 'undefined'}`;
        else return `const $$${this.name.join('$$')} = ${this.initValue!.toJS()}`;
    }

    public static parse(c: Consumer, i: number) {
        let n = 0;

        let mutable = false;

        switch (c.get(i + n)?.identifier) {
            case 'let':
                mutable = true;
                break;
            case 'const':
                break;
            default:
                return ParseResult.fail;
        }

        n++;

        const name = parseIdentifier(c, i + n);
        if (name.failed) return name.error(new Message("Expected a variable name", errLoc(c, i, n)));
        n += name.n;

        let init: ParseResult<Node>  | undefined;

        if (c.get(i + n)?.isOperator(Operator.Assign)) {
            n++;

            init = parseExpression(c, i + n);
            if (init.failed) return init.error(new Message("Expected an expression", errLoc(c, i, n)));
            n += init.n;
        }
        else if (!mutable) return ParseResult.error(new Message("Expected an initializer for constant", errLoc(c, i, n)));

        return ParseResult.res(new VarDeclareNode(name.val!, mutable, init?.val), n);
    }
}