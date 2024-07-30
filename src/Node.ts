import { Expression } from "./parsing/base";
import { Result } from "./transforming/Result";
import { IterationResult } from "./transforming/TransformerHost";

export abstract class Node implements Iterable<Node> {
    public constructor(public readonly loc: string) { }

    public abstract simplify(): Expression;

    public *[Symbol.iterator](): Iterator<Node> { }
}
