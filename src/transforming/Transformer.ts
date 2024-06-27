import { Node } from "../Node";
import { NoopNode } from "../parsing";
import { IfNode } from "../parsing/statement";
import { Constructor } from "../utils/types";

export enum TransformStage {
    Simplify,
    Resolve,
}

interface Transformer {
    (node: Node, stage: TransformStage): Node | void;
}
interface TypedTransformer<T extends Node = Node> {
    (node: Node, stage: TransformStage): Node | void;
    type: Constructor<T>;
    rawTransformer(node: T, stage: TransformStage): Node | void;
}

function Transformer(func: (node: Node, stage: TransformStage) => Node | void, type?: void, stage?: TransformStage): Transformer;
function Transformer<T extends Node>(func: (node: T, stage: TransformStage) => Node | void, type: Constructor<T>, stage?: TransformStage): TypedTransformer<T>;
function Transformer(func: any, type?: any, stage?: any) {
    if (type != null) return Object.assign((node: Node, s: TransformStage) => {
        if (!(node instanceof type)) return;
        if (stage != null && stage !== s) return;
        return func(node, s);
    }, { type, rawTransformer: func });
    else if (stage != null) return ((node: Node, s: TransformStage) => {
        if (stage != null && stage !== s) return;
        return func(node, s);
    });
    else return func;
}

Transformer((node, stage) => {}, IfNode, TransformStage.Resolve);

export interface Transformers extends Transformer {
    add(transformer: Transformer): void;
    add<T extends Node>(transformer: TypedTransformer<T>): void;
}

export function Transformers(): Transformers {
    const map = new Map<Constructor<Node> | void, Set<Transformer>>();

    return Object.assign((node: Node, stage: TransformStage) => {
        for (const [type, transformers] of map) {
            if (type != null && !(node instanceof type)) continue;

            for (const t of transformers) {
                const res = t(node, stage);
                if (res != null) return res;
            }
        }
    }, {
        add: (transformer: Transformer | TypedTransformer) => {
            if ('type' in transformer && transformer.type != null) {
                if (!map.has(transformer.type)) map.set(transformer.type, new Set());
                map.get(transformer.type)!.add(transformer);
            }
            else {
                if (!map.has(undefined)) map.set(undefined, new Set());
                map.get(undefined)!.add(transformer);
            }
        }
    });
}

export default Transformer;
