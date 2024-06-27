import { parseIdentifier, parseInit } from ".";
import { Node } from "../Node";
import { Source } from "../utils/Source";
import { Result } from "./result";

export class TypeRefNode extends Node {
    public constructor(
        loc: string,
        public readonly name: string,
    ) { super(loc); }

    public static readonly precedence = 1;

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const name = parseIdentifier(s, i + n);
        if (name.type !== 'res') return name;
        n += name.n;

        return Result.val(new TypeRefNode(s.loc(loc), name.val), n);
    }
}

export function parseType(s: Source, i: number) {
    const typeRef = TypeRefNode.parse(s, i);
    if (typeRef.type !== 'fail') return typeRef;

    return Result.fail;
}

