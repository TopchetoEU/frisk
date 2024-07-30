import { Node } from "../Node";
import { Result } from "./Result";

export type IterationResult = Generator<Node[], string | Node[], Node[]>;

export class TransformerHost {
    private _transformers = new Set<{ transformer(path: Node[], lastCall: boolean, host: TransformerHost): Result, loc: string }>();

    public add(location: string, transformer: (path: Node[], lastCall: boolean, host: TransformerHost) => Result) {
        this._transformers.add({ transformer, loc: location });
        return this;
    }

    public run(nodes: Node[], maxIterations = 1000) {
        const self = this;

        function iterate(nodes: Node[], path: Node[], lastCall: boolean): { res: Result, anyResult: boolean } {
            let anyResult = false;

            const results = nodes.map(node => {
                const childPath = [node, ...path];
                const gen = node.iterate();

                let it = gen.next();
                while (!it.done) {
                    const { res, anyResult: ar } = iterate(it.value, childPath, lastCall);

                    if (ar) {
                        lastCall = false;
                        anyResult = true;
                    }

                    if (res.type === 'err') return res;
                    if (res.type === 'fail') it = gen.next(it.value);
                    if (res.type === 'val') it = gen.next(res.nodes);
                }

                if (typeof it.value === 'string') return Result.err("<transformer>", it.value);
                else return Result.val(...it.value);
            });

            nodes = [];

            for (const res of results) {
                if (res.type === 'err') return { res, anyResult: false };
                else nodes.push(...res.nodes);
            }

            const resNodes: Node[] = [];

            loop: for (const node of nodes) {
                const currPath = [node, ...path.slice(1)];

                for (const { transformer, loc } of [ { transformer: node.transform.bind(node), loc: node.loc }, ...self._transformers ]) {
                    const res = transformer(currPath, lastCall, self);

                    if (res.type === 'val') {
                        resNodes.push(...res.nodes);
                        if (res.nodes.length !== 1 || !Node.equal(res.nodes[0], node)) {
                            anyResult = true;
                            continue loop;
                        }
                    }
                    else if (res.type === 'err') {
                        if (lastCall || res.fatal) return { res, anyResult };
                    }
                }

                resNodes.push(node);
            }

            if (anyResult) return { res: Result.val(...resNodes), anyResult: true };
            else return { res: Result.fail, anyResult: false };
        }

        let lastCall = false;
        let i = 0;

        while (true) {
            if (i > maxIterations) return Result.err("<transformer>", "Too many transform iterations", true);
            const { res, anyResult } = iterate(nodes, [], lastCall);

            if (res.type === 'err') return res;
            if (res.type === 'val') nodes = res.nodes;

            if (lastCall && !anyResult) break;
            lastCall = !anyResult;
            i++;
        }

        return Result.val(...nodes);
    }
}
