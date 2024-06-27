import { Source } from "./utils/Source";
import { Result } from "./parsing/result";
import { skipWhite } from "./parsing";
import { Node } from "./Node";
import { parseDefinition } from "./parsing/defs";
import * as fs from "fs";

const res: Node[] = [];
const msgs: string[] = [];

for (const file of process.argv.slice(2)) {
    const src = new Source(file, fs.readFileSync(file).toString());
    let i = 0;

    while (true) {
        i += skipWhite(src, i);
        if (i >= src.source.length) break;

        const exp = parseDefinition(src, i);
        if (exp.type !== 'res') {
            const err = Result.err("Unexpected syntax", src.loc(i), exp);
            msgs.push(err.loc + ':' + err.msg!);
            break;
        }
        else res.push(exp.val!);
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
