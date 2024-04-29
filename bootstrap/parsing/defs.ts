import { Message } from "../utils/Message.ts";
import { Namespace } from "../utils/Namespace.ts";
import { Operator } from "../utils/Operator.ts";
import { Consumer } from "./Consumer.ts";
import { Node } from "./Node.ts";
import { ParseResult, errLoc, parseIdentifier, parseDelimList, AsmNode } from "./common.ts";
import { VarDeclareNode, parseBody } from "./statement.ts";

export function parseDefinition(c: Consumer, i: number): ParseResult<Node> {
    const res = ParseResult.first<{ res: Node, sc: boolean }>(
        () => AsmNode.parse(c, i).map(v => ({ res: v, sc: true })),
        () => EntrypointNode.parse(c, i).map(v => ({ res: v, sc: false })),
        () => VarDeclareNode.parse(c, i).map(v => ({ res: v, sc: true })),
        () => FunctionNode.parse(c, i).map(v => ({ res: v, sc: false })),
    );

    if (res.failed) return res.error();
    let n = res.n;

    if (res.val?.sc) {
        if (!c.get(i + n)?.isOperator(Operator.Semicolon)) return res.error(new Message("Expected a semicolon after definition", errLoc(c, i, res.n)));
        n++;
    }
    return ParseResult.res(res.val!.res, n);
}

export class FunctionNode implements Node {
    public constructor(
        public readonly name: Namespace,
        public readonly params: Namespace[],
        public readonly body: Node[] = [],
    ) { }

    public toJS() {
        return `function $$${this.name.join('$$')}(${this.params.map(v => '$$' + v.join('$$')).join(',')}){${this.body.map(v => v.toJS()).join(';')}}`;
    }

    public static parse(c: Consumer, i: number) {
        let n = 0;

        const name = parseIdentifier(c, i + n);
        if (name.failed) return name.error();
        n += name.n;

        const params = parseDelimList(c, i + n,
            Operator.ParenOpen, Operator.ParenClose, Operator.Comma,
            'parameter', parseIdentifier
        );
        if (params.failed) return params.error(new Message("Expected a parameter list", errLoc(c, i, n)));
        n += params.n;

        const body = parseBody(c, i + n);
        if (body.failed) return body.error(new Message("Expected a function body", errLoc(c, i, n)));
        n += body.n;

        return ParseResult.res(new FunctionNode(name.val!, params.val!, body.val!), n);
    }
}
export class EntrypointNode implements Node {
    public constructor(public readonly body: Node[] = []) { }

    public toJS() {
        return `{${this.body.map(v => v.toJS()).join(';')}}`;
    }

    public static parse(c: Consumer, i: number) {
        if (!c.get(i)?.isIdentifier("entry")) return ParseResult.fail;
        let n = 1;

        const body = parseBody(c, i + n);
        if (body.failed) return body.error(new Message("Expected an entrypoint body", errLoc(c, i, n)));
        n += body.n;

        return ParseResult.res(new EntrypointNode(body.val!), n);
    }
}