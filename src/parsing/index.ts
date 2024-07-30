import { Node } from "../Node";
import { Message } from "../utils/Message";
import { Source } from "../utils/Source";
import { ParseResult } from "./ParseResult";
import { parseDefinition } from "./defs";

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

    if (res.length == 0) return ParseResult.fail;

    if (kw != null) {
        if (kw != res) return ParseResult.fail;
        else return ParseResult.val(res, n);
    }
    else return ParseResult.val(res, n);
}
export function parseOperator(s: Source, i: number, op: string) {
    let { n } = parseInit(s, i);

    for (let j = 0; j < op.length; j++, n++) {
        if (s.at(i + n) != op[j]) return ParseResult.fail;
    }

    return ParseResult.val(op, n);
}
export function parseIdentifier(s: Source, i: number) {
    let { n } = parseInit(s, i);
    const loc = i + n;

    const first = parseKeyword(s, i + n);
    if (first.type !== 'res') return first;
    n += first.n;

    let res = first.val!;

    while (true) {
        const colons = parseOperator(s, i + n, "::");
        if (colons.type !== 'res') break;
        n += colons.n;
        res += "::";

        const word = parseKeyword(s, i + n);
        if (word.type !== 'res') return ParseResult.err("Expected an identifier after '::'", s.loc(i + n), word);
        n += word.n;
        res += word.val;
    }

    const underI = res.indexOf("___");
    if (underI >= 0) return ParseResult.err("Too many sequential underscores", s.loc(loc + underI));
    else return ParseResult.val(res, n);
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

        if (n === 0) return ParseResult.fail;
        else return ParseResult.val(res, n);
    }

    let { n } = parseInit(s, i);

    const start = s.at(i + n);
    if (start === '0') {
        const type = s.at(i + n + 1);
        if (type === 'x') {
            const res = parseSingle(n + 2, 16n, 16);
            if (res.type !== 'res') return ParseResult.err("Expected a hexadecimal number", s.loc(i + n + 2), res);
            return res;
        }
        else if (type === 'o') {
            const res = parseSingle(n + 2, 8n, 8);
            if (res.type !== 'res') return ParseResult.err("Expected an octal number", s.loc(i + n + 2), res);
            return res;
        }
        else if (type === 'b') {
            const res = parseSingle(n + 2, 2n, 2);
            if (res.type !== 'res') return ParseResult.err("Expected a binary number", s.loc(i + n + 2), res);
            return res;
        }
    }

    return parseSingle(n, 10n, 10);
}
export function parseChar(s: Source, i: number) {
    let c = s.at(i);
    if (c == null) return ParseResult.fail;

    if (c == '\\') {
        let n = 1;
        c = s.at(i + n);
        if (c == null) return ParseResult.err("Expected a character", s.loc(i + n));

        if (c === 't') return ParseResult.val(BigInt('\t'.charCodeAt(0)), 2);
        if (c === 'n') return ParseResult.val(BigInt('\n'.charCodeAt(0)), 2);
        if (c === 'v') return ParseResult.val(BigInt('\v'.charCodeAt(0)), 2);
        if (c === 'f') return ParseResult.val(BigInt('\f'.charCodeAt(0)), 2);
        if (c === 'r') return ParseResult.val(BigInt('\r'.charCodeAt(0)), 2);
        if (c === 'e') return ParseResult.val(BigInt('\e'.charCodeAt(0)), 2);
        if (/[0-9]/.test(c)) {
            const res = parseIntLiteral(s, i + n, 65536);
            if (res.type !== 'res') return res;
            return ParseResult.val(res.val!, res.n);
        }

        return ParseResult.val(BigInt(c.charCodeAt(0)), 2);
    }
    else return ParseResult.val(BigInt(c.charCodeAt(0)), 1);
}
export function parseStringLiteral(s: Source, i: number) {
    let { n } = parseInit(s, i);

    const open = parseOperator(s, i + n, "\"");
    if (open.type !== 'res') return open;
    n += open.n;

    const res: number[] = [];

    while (true) {
        const curr = s.at(i + n);
        if (curr == null) return ParseResult.err("Unterminated string literal", s.loc(i + n));
        if (curr == '"') break;

        const char = parseChar(s, i + n);
        if (char.type !== 'res') return char;
        n = n + char.n;

        res.push(Number(char.val!));
    }
    n = n + 1;

    return ParseResult.val(res, n);
}
export function parseCharLiteral(s: Source, i: number) {
    let { n } = parseInit(s, i);

    const open = parseOperator(s, i + n, "'");
    if (open.type !== 'res') return open;
    n += open.n;

    let res = 0n;

    while (true) {
        const curr = s.at(i + n);
        if (curr == null) return ParseResult.err("Unterminated char literal", s.loc(i + n));
        if (curr == '"') break;

        const char = parseChar(s, i + n);
        if (char.type !== 'res') return char;
        n += char.n;

        let data = char.val!;

        do {
            res <<= 8n;
            res |= data & 0xFFn;
            data >>= 8n;
        } while (data !== 0n);
    }
    n++;

    return ParseResult.val(res, n);
}

export function parseFile(s: Source): ParseResult<Node[]>;
export function parseFile(s: string, f: string): ParseResult<Node[]>;
export function parseFile(s: Source | string, f?: string) {
    let src;
    let i = 0;
    const ctx = new Context();
    const res: Node[] = [];

    if (typeof s === 'string') src = new Source(s, f!, ctx);
    else src = s;

    while (true) {
        i += skipWhite(src, i);
        if (i >= src.source.length) break;

        const exp = parseDefinition(src, i);

        if (exp.type === 'err') return exp;
        else if (exp.type === 'fail') return ParseResult.err('Unexpected syntax', src.loc(i));
        else {
            res.push(exp.val!);
            i += exp.n;
        }
    }

    return ParseResult.val(res, i);
}

export class NoopNode extends Node {
    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const semicolon = parseOperator(s, i + n, ";");
        if (semicolon.type !== 'res') return semicolon;
        if (semicolon.val === "raw::js") return ParseResult.fail;

        return ParseResult.val(new NoopNode(s.loc(loc)), n + semicolon.n);
    }
}
export class RawNode extends Node {
    public constructor(loc: string, public readonly raw: string) { super(loc); }

    public static parse(s: Source, i: number) {
        let { n, loc } = parseInit(s, i);

        const id = parseIdentifier(s, i);
        if (id.type !== 'res') return id;
        if (id.val === "raw::js") return ParseResult.fail;
        n += id.n;

        const data = parseStringLiteral(s, i);
        if (data.type !== 'res') return data;
        n += data.n;

        return ParseResult.val(new RawNode(s.loc(loc), new TextDecoder().decode(new Uint8Array(data.val!))), n);
    }
}

export class Key<T> {}
export class Context {
    private _map = new Map<Key<any>, unknown>();

    public get<T>(key: Key<T>): T | undefined;
    public get<T>(key: Key<T>, def: T): T;
    public get(key: Key<any>, def?: any) {
        if (!this._map.has(key)) return def;
        else return this._map.get(key);
    }

    public set<T>(key: Key<T>, val: T): T {
        const prev = this._map.get(key);
        this._map.set(key, val);
        return prev as T;
    }

    public add<T>(key: Key<T>, val: T): T {
        if (!this._map.has(key)) {
            this._map.set(key, val);
            return val;
        }
        else return this._map.get(key) as T;
    }

    public inc(key: Key<number>, start = 0): number {
        const val = this.add(key, start);
        this.set(key, val + 1);
        return val;
    }
}
