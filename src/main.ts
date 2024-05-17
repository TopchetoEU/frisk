import { Token } from "./parsing/Token.ts";
import { Consumer } from "./parsing/Consumer.ts";
import { Message } from "./utils/Message.ts";
import { loc } from "./parsing/common.ts";
import { EntrypointNode, FunctionNode, parseDefinition } from "./parsing/defs.ts";
import { Node } from "./parsing/Node.ts";

try {
    const res: Node[] = [];
    const msgs = new Message();

    for (const file of Deno.args.slice(1)) {
        const consumer = new Consumer([ ...Token.parseMany(new TextDecoder().decode(Deno.readFileSync(file)), file) ]);
        let n = 0;

        while (n < consumer.tokens.length) {
            const exp = parseDefinition(consumer, n);
            if (exp.failed) {
                msgs.push(exp.error(new Message(`Expected a definition`, loc(consumer, n))).msg!);
                break;
            }
            else res.push(exp.val!);
            n += exp.n;
        }
    }

    if (msgs.children.length > 0) throw msgs;

    const entrypoints: string[] = [];
    const others: string[] = [];
    const funcs: string[] = [];

    for (const def of res) {
        if (def instanceof EntrypointNode) entrypoints.push(def.toJS());
        else if (def instanceof FunctionNode) funcs.push(def.toJS());
        else others.push(def.toJS());
    }

    const src = [ ...funcs, ...others, ...entrypoints ].join(';\n');

    if (Deno.args[0] === '-') console.log(src);
    else Deno.writeFileSync(Deno.args[0], new TextEncoder().encode(src));

}
catch (e) {
    if (e instanceof Message) e.print();
    else throw e;
}
