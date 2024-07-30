import { TransformerHost } from "./transforming/TransformerHost";
import { parseFile } from "./parsing";
import { Node } from "./Node";
import { Message } from "./utils/Message";
import * as fs from "fs";

const nodes: Node[] = [];
const errors: Message[] = [];

for (const file of process.argv.slice(2)) {
    const res = parseFile(fs.readFileSync(file).toString(), file);
    if (res.type === 'res')  nodes.push(...res.val);
    else if (res.type === 'err') errors.push(res);
    else errors.push({ loc: file, msg: "Failed to compile" });
}

const host = new TransformerHost();
const transformed: any = host.run(nodes);

if (transformed.type === 'err') {
    console.error(transformed.loc + ": " + transformed.msg);
    process.exit(1);
}

console.log(transformed.nodes);

debugger;

if (errors.length > 0) {
    for (const { loc, msg } of errors) console.error(`${loc}: ${msg}`);
    process.exit(1);
}
