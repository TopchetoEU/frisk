import { Result } from "./transforming/Result";
import { IterationResult } from "./transforming/TransformerHost";

export abstract class Node {
    public constructor(public readonly loc: string) { }

    public *iterate(): IterationResult {
        return [this];
    }

    public transform(): Result {
        return Result.fail;
    }

    public equals(other: Node) {
        return this === other;
    }

    public static equal(a?: Node, b?: Node) {
        if (a === b) return true;
        if (a == null || b == null) return a == null && b == null;

        if (a.equals != null) return a.equals(b);
        if (b.equals != null) return b.equals(a);

        return false;
    }
}
