import { Chars } from "../utils/Chars.ts";
import { Location } from "../utils/Location.ts";
import { Message } from "../utils/Message.ts";
import { Operator } from "../utils/Operator.ts";
import { RawToken, RawTokenKind } from "./RawToken.ts";

export enum TokenKind { Identifier, Operator, Int, Char, Float, String }

export class Token {
    private readonly data: unknown;
    public readonly kind: TokenKind;
    public readonly location: Location;

    public get identifier() { return this.kind === TokenKind.Identifier ? this.data as string : undefined; }
    public get operator() { return this.kind === TokenKind.Operator ? this.data as Operator : undefined; }
    public get intLiteral() { return this.kind === TokenKind.Int ? this.data as bigint : undefined; }
    public get charLiteral() { return this.kind === TokenKind.Char ? this.data as bigint : undefined; }
    public get floatLiteral() { return this.kind === TokenKind.Float ? this.data as number : undefined; }
    public get stringLiteral() { return this.kind === TokenKind.String ? this.data as Uint16Array : undefined; }

    public isOperator(op?: Operator) {
        if (this.kind !== TokenKind.Operator) return false;
        if (op === undefined) return true;
        return op === this.data;
    }
    public isIdentifier(val?: string) {
        if (this.kind !== TokenKind.Identifier) return false;
        if (val === undefined) return true;
        return val === this.data;
    }

    public toString() {
        if (this.kind === TokenKind.Operator) return `operator: ${Operator.stringify(this.operator!)} @ ${this.location}`;
        return `${this.kind}: ${this.data} @ ${this.location}`;
    }

    public constructor(kind: TokenKind.Identifier, val: string, loc?: Location);
    public constructor(kind: TokenKind.Operator, val: Operator, loc?: Location);
    public constructor(kind: TokenKind.Int, val: bigint, loc?: Location);
    public constructor(kind: TokenKind.Char, val: bigint, loc?: Location);
    public constructor(kind: TokenKind.Float, val: number, loc?: Location);
    public constructor(kind: TokenKind.String, val: Uint16Array, loc?: Location);
    public constructor(kind: TokenKind, val: unknown, loc = Location.None) {
        this.kind = kind;
        this.data = val;
        this.location = loc;
    }

    private static *parseString(isChar: boolean, token: RawToken) {
        const literalChar = isChar ? '\'' : '"';
        let escaping = false;

        const filename = token.location.filename;
        let start = token.location.start ?? 0 + 1;
        let codestart = token.location.codeStart ?? 0 + 1;
        let line = token.location.line ?? 0;

        for (let i = 1; i < token.data.length; i++) {
            let c = token.data[i];
            const loc = new Location(filename, line, start, 1, codestart);
            if (c === '\n') line++;

            if (escaping) {
                if (c == 't') yield 0x09;
                else if (c == 'n') yield 0x0A;
                else if (c == 'v') yield 0x0B;
                else if (c == 'f') yield 0x0C;
                else if (c == 'r') yield 0x0D;
                else if (c == 'e') yield 0x1B;
                else if (c == 'x') {
                    let newChar = 0, n = 0;
                    i++, c = token.data[i];

                    for (; Chars.hex(c) && n < token.data.length; n++, i++, c = token.data[i]) {
                        newChar <<= 4;
                        if (Chars.lower(c)) newChar |= c.charCodeAt(0) - 97 + 10;
                        if (Chars.upper(c)) newChar |= c.charCodeAt(0) - 65 + 10;
                        if (Chars.digit(c)) newChar |= c.charCodeAt(0) - 48;
                        if (newChar >= 65536) { newChar >>= 4; break; }
                    }

                    if (n === 0) throw new Message('Expected a hexadecimal after escaped "x"', loc);

                    start += n - 1, codestart += n - 1, i--;
                    yield newChar;
                }
                else if (Chars.octal(c)) {
                    let newChar = 0, n = 0;

                    for (; Chars.octal(c) && n < token.data.length; n++, i++, c = token.data[i]) {
                        newChar <<= 3;
                        newChar |= c.charCodeAt(0) - 48;
                        if (newChar >= 256) { newChar >>= 4; break; }
                    }

                    start += n - 1, codestart += n - 1, i--;
                    yield newChar;
                }
                else if (c === literalChar || c === '\\') yield c.charCodeAt(0);
                else if (c !== '\n') {
                    throw new Message("Unescapable character.", loc);
                }

                escaping = false;
            }
            else {
                if (c === '\\') escaping = true;
                else if (c === literalChar) return;
                else yield c.charCodeAt(0);
            }

            start++, codestart++;
        }

        throw new Message(`Unterminated ${isChar ? 'char' : 'string'} literal.`, token.location);
    }
    private static parseBin(i: number, data: string) {
        return data
            .slice(i)
            .split('')
            .reduce((prev, v) => (prev << 1n) | BigInt(v.charCodeAt(0) - 48), 0n);
    }
    private static parseHex(i: number, data: string) {
        return data
            .slice(i)
            .split('')
            .reduce((prev, v) => {
                if (Chars.lower(v)) return (prev << 4n) | BigInt(v.charCodeAt(0) - 97 + 10);
                if (Chars.upper(v)) return (prev << 4n) | BigInt(v.charCodeAt(0) - 65 + 10);
                if (Chars.digit(v)) return (prev << 4n) | BigInt(v.charCodeAt(0) - 48);
                return prev;
            }, 0n);
    }
    private static parseOct(i: number, data: string) {
        return data
            .slice(i)
            .split('')
            .reduce((prev, v) => (prev << 3n) | BigInt(v.charCodeAt(0) - 48), 0n);
    }
    private static parseDec(i: number, data: string) {
        return BigInt(data.substring(i));
    }
    private static parseFloat(data: string) {
        return Number.parseFloat(data);
    }
    private static parseChar(token: RawToken) {
        let res = 0n;

        for (let c of this.parseString(true, token)) {
            do {
                res <<= 8n;
                res |= BigInt(c & 0xFF);
                c >>= 8;
            } while (c !== 0);
        }

        return res;
    }

    public static parse(raw: RawToken) {
        if (raw.type == RawTokenKind.Operator) {
            const op = Operator.find(raw.data);
            if (op === Operator.None) throw new Message("Operator not recognized.", raw.location);
            else return new Token(TokenKind.Operator, op, raw.location);
        }

        switch (raw.type) {
            case RawTokenKind.Identifier: return new Token(TokenKind.Identifier, raw.data, raw.location);
            case RawTokenKind.Bin: return new Token(TokenKind.Int, this.parseBin(2, raw.data), raw.location);
            case RawTokenKind.Oct: return new Token(TokenKind.Int, this.parseOct(1, raw.data), raw.location);
            case RawTokenKind.Dec: return new Token(TokenKind.Int, this.parseDec(0, raw.data), raw.location);
            case RawTokenKind.Hex: return new Token(TokenKind.Int, this.parseHex(2, raw.data), raw.location);
            case RawTokenKind.Char: return new Token(TokenKind.Char, this.parseChar(raw), raw.location);
            case RawTokenKind.Float: return new Token(TokenKind.Float, this.parseFloat(raw.data), raw.location);
            case RawTokenKind.String: return new Token(TokenKind.String, new Uint16Array(this.parseString(false, raw)), raw.location);
            default: throw new Message(`Token type ${raw.type} not recognized.`, raw.location);
        }
    }

    public static *parseMany(raw: string, filename: string) {
        for (const el of RawToken.parseMany(<string>raw, filename)) yield this.parse(el);
    }
}
