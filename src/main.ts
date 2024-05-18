import { Source } from "./utils/Source";
import { ParseRes } from "./parsing/result";
import { Node, skipWhite } from "./parsing";
import { parseDefinition } from "./parsing/defs";
import * as fs from "fs";

const res: Node[] = [];
const msgs: string[] = [];

for (const file of process.argv.slice(2)) {
    const src = new Source(file, fs.readFileSync(file).toString());
    let i = 0;

    while (i < src.source.length) {
        i += skipWhite(src, i);
        const exp = parseDefinition(src, i);
        if (exp.failed()) {
            const err = ParseRes.err("Unexpected syntax", i, exp);
            msgs.push(src.toLoc(err.loc) + ':' + err.msg!);
            break;
        }
        else res.push(exp.res!);
        i += exp.n;
        i += skipWhite(src, i);
    }
}

if (msgs.length > 0) {
    for (const el of msgs) console.error(el);
    process.exit(1);
}

console.log(res);
debugger;

// const entrypoints: string[] = [];
// const others: string[] = [];
// const funcs: string[] = [];

// for (const def of res) {
//     if (def instanceof EntrypointNode) entrypoints.push(def.toJS());
//     else if (def instanceof FunctionNode) funcs.push(def.toJS());
//     else others.push(def.toJS());
// }

// const src = [ ...funcs, ...others, ...entrypoints ].join(';\n');

// if (process.argv[2] === '-') console.log(src);
// else Deno.writeFileSync(Deno.args[0], new TextEncoder().encode(src));
