import { Node } from "../Node";
import { WhileNode } from "../parsing/statement";

export interface CFGNode {
    next?: CFGNode;
    node?: Node;
    onTrue?: Node;
}

export class CFG {
    private _nodes = new Set<CFGNode>();
    private _parents = new Map<CFGNode, Set<CFGNode>>();

    public parents(node: CFGNode) {
        return this._parents.get(node) ?? [];
    }
    public nodes() {
        return [...this._nodes];
    }

    // public equals(other: Node): boolean {
    //     if (this === other) return true;
    //     if (!(other instanceof CFGRoot)) return false;

    //     if (this.nodes.size !== other.nodes.size) return false;
    //     for (const el of this.nodes) {
    //         if (!other.nodes.has(el)) return false;
    //     }

    //     return true;
    // }

    public constructor(...nodes: CFGNode[]) {
        const stack: [curr: CFGNode, parent?: CFGNode][] = [ [nodes[0]] ];

        while (true) {
            if (stack.length === 0) break;
            const [node, parent] = stack.pop()!;
            if (this._nodes.has(node)) continue;

            this._nodes.add(node);
            if (parent != null) {
                if (!this._parents.has(parent)) this._parents.set(parent, new Set());
                this._parents.get(node)!.add(node);
            }

            if (node.next) stack.push([node.next, node]);
        }
    }
}

function loopToCFG(loop: WhileNode, prev: CFGNode) {
    loop.beforeBody
}

export function bodyToCFG(body: Node[]) {
    const res: CFGNode[] = [];

    for (const )
}