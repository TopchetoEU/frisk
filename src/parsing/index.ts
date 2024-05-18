import { Source } from "../utils/Source";
import { ParseRes } from "./result";

export function skipWhite(s: Source, i: number) {
    let n = 0;
    let commentState: undefined | "one_slash" | "single" | "multi_first" | "multi" | "end";

    while (true) {
        const c = s.at(i + n);
        if (c == null) break;

        if (commentState === "one_slash") {
            if (c === '/') commentState = "single";
            else if (c === '*') commentState = "multi";
            else return n - 1;
        }
        else if (commentState === "single") {
            if (c === '\n') commentState = "end";
        }
        else if (commentState === "multi") {
            if (c === '*') commentState = "multi_first";
        }
        else if (commentState === "multi_first") {
            if (c === '/') commentState = "end";
            else if (c != '*') commentState = "multi";
        }
        else if (c === '/') commentState = "one_slash";

        if (commentState === undefined && c !== ' ' && c !== '\n' && c !== '\t') return n;
        if (commentState === "end") commentState = undefined;

        n++;
    }

    return n;
}
export function parseInit(s: Source, i: number) {
    const n = skipWhite(s, i);

    return { n, loc: i + n };
}

export function parseKeyword(s: Source, i: number, kw?: string) {
    let { n } = parseInit(s, i);
    let res = "";

    while (true) {
        const c = s.at(i + n);

        if (c == null) break;
        if (!c.match(/[\w\d_]/g)) break;

        res += c;
        n++;
    }

    if (res.length == 0) return ParseRes.fail;

    if (kw != null) {
        if (kw != res) return ParseRes.fail;
        else return ParseRes.val(res, n);
    }
    else return ParseRes.val(res, n);
}
export function parseOperator(s: Source, i: number, op: string) {
    let { n } = parseInit(s, i);

    for (let j = 0; j < op.length; j++, n++) {
        if (s.at(i + n) != op[j]) return ParseRes.fail;
    }

    return ParseRes.val(op, n);
}
export function parseIdentifier(s: Source, i: number) {
    let { n } = parseInit(s, i);
    const loc = i + n;

    const first = parseKeyword(s, i + n);
    if (first.failed()) return first;
    n += first.n;

    let res = first.res!;

    while (true) {
        const colons = parseOperator(s, i + n, "::");
        if (colons.failed()) break;
        n += colons.n;
        res += "::";

        const word = parseKeyword(s, i + n);
        if (word.res == null) return ParseRes.err("Expected an identifier after '::'", i + n, word);
        n += word.n;
        res += word.res;
    }

    const underI = res.indexOf("___");
    if (underI >= 0) return ParseRes.err("Too many sequential underscores", loc + underI);
    else return ParseRes.val(res, n);
}

export function parseIntLiteral(s: Source, i: number, max?: number) {
    function parseSingle(n: number, radix: bigint, radixn: number) {
        let res = 0n;

        while (true) {
            const digit = Number.parseInt(s.at(i + n) ?? "", radixn);
            if (isNaN(digit)) break;
            const digitb = BigInt(digit);
            if (max != null && res * radix + BigInt(digitb) >= max) break;

            res = res * radix + digitb;
            n++;
        }

        if (n === 0) return ParseRes.fail;
        else return ParseRes.val(res, n);
    }

    let { n } = parseInit(s, i);

    const start = s.at(i + n);
    if (start === '0') {
        const type = s.at(i + n + 1);
        if (type === 'x') {
            const res = parseSingle(n + 2, 16n, 16);
            if (res.failed()) return ParseRes.err("Expected a hexadecimal number", n + 2, res);
            return res;
        }
        else if (type === 'o') {
            const res = parseSingle(n + 2, 8n, 8);
            if (res.failed()) return ParseRes.err("Expected an octal number", n + 2, res);
            return res;
        }
        else if (type === 'b') {
            const res = parseSingle(n + 2, 2n, 2);
            if (res.failed()) return ParseRes.err("Expected a binary number", n + 2, res);
            return res;
        }
    }

    return parseSingle(n, 10n, 10);
}
export function parseChar(s: Source, i: number) {
    let c = s.at(i);
    if (c == null) return ParseRes.fail;

    if (c == '\\') {
        let n = 1;
        c = s.at(i + n);
        if (c == null) return ParseRes.err("Expected a character", i + n);

        if (c === 't') return ParseRes.val(BigInt('\t'.charCodeAt(0)), 2);
        if (c === 'n') return ParseRes.val(BigInt('\n'.charCodeAt(0)), 2);
        if (c === 'v') return ParseRes.val(BigInt('\v'.charCodeAt(0)), 2);
        if (c === 'f') return ParseRes.val(BigInt('\f'.charCodeAt(0)), 2);
        if (c === 'r') return ParseRes.val(BigInt('\r'.charCodeAt(0)), 2);
        if (c === 'e') return ParseRes.val(BigInt('\e'.charCodeAt(0)), 2);
        if (/[0-9]/.test(c)) {
            const res = parseIntLiteral(s, i + n, 65536);
            if (res.failed()) return res;
            return ParseRes.val(res.res!, res.n);
        }

        return ParseRes.val(BigInt(c.charCodeAt(0)), 2);
    }
    else return ParseRes.val(BigInt(c.charCodeAt(0)), 1);
}
export function parseStringLiteral(s: Source, i: number) {
    let { n } = parseInit(s, i);

    const open = parseOperator(s, i + n, "\"");
    if (open.failed()) return open;
    n += open.n;

    const res: number[] = [];

    while (true) {
        const curr = s.at(i + n);
        if (curr == null) return ParseRes.err("Unterminated string literal", i + n);
        if (curr == '"') break;

        const char = parseChar(s, i + n);
        if (char.failed()) return char;
        n = n + char.n;

        res.push(Number(char.res!));
    }
    n = n + 1;

    return ParseRes.val(res, n);
}
export function parseCharLiteral(s: Source, i: number) {
    let { n } = parseInit(s, i);

    const open = parseOperator(s, i + n, "'");
    if (open.failed()) return open;
    n += open.n;

    let res = 0n;

    while (true) {
        const curr = s.at(i + n);
        if (curr == null) return ParseRes.err("Unterminated char literal", i + n);
        if (curr == '"') break;

        const char = parseChar(s, i + n);
        if (char.failed()) return char;
        n += char.n;

        let data = char.res!;

        do {
            res <<= 8n;
            res |= data & 0xFFn;
            data >>= 8n;
        } while (data !== 0n);
    }
    n++;

    return ParseRes.val(res, n);
}

export class Node {
    public constructor(public readonly loc: string) { }
}

export class NoopNode extends Node {
    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const semicolon = parseOperator(s, i + n, ";");
        if (semicolon.failed()) return semicolon;
        if (semicolon.res === "raw::js") return ParseRes.fail;

        return ParseRes.val(new NoopNode(s.toLoc(loc)), n + semicolon.n);
    }
}
export class RawNode extends Node {
    public constructor(loc: string, public readonly raw: string) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const id = parseIdentifier(s, i);
        if (id.failed()) return id;
        if (id.res === "raw::js") return ParseRes.fail;
        n += id.n;

        const data = parseStringLiteral(s, i);
        if (data.failed()) return data;
        n += data.n;

        return ParseRes.val(new RawNode(s.toLoc(loc), new TextDecoder().decode(new Uint8Array(data.res!))), n);
    }
}
