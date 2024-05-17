import { Chars } from "../utils/Chars.ts";
import { Location } from "../utils/Location.ts";
import { Message } from "../utils/Message.ts";
import { Operator } from "../utils/Operator.ts";

export enum RawTokenKind { None, Identifier, Operator, Bin, Oct, Dec, Hex, Float, String, Char }

export class RawToken {
    public constructor(
        public readonly type: RawTokenKind,
        public readonly data: string,
        public readonly location: Location
    ) { }

    public static *parseMany(src: string, filename: string) {
        let currToken = '';
        let comment = false, multicomment = false;
        let start = 0, line = 0, codeStart = 0, currStart = 0, currLine = 0;
        let type = RawTokenKind.None;

        let i = 0, repeat = false, c = '', prev = '';

        function ret(rep = true) {
            if (!rep) currToken += c;
            const res = new RawToken(type, currToken, new Location(filename, line, start, currToken.length, codeStart));

            repeat = rep, currToken = '', type = RawTokenKind.None;

            return res;
        }


        for (c of src) {
            do {
                repeat = false;
                if (comment) comment = c != '\n';
                else if (multicomment) multicomment = !(c === '/' && prev === '*');
                else if (type === RawTokenKind.String || type === RawTokenKind.Char) {
                    let n = 0;

                    do {
                        n++;
                    } while (currToken.at(-n) === '\\');

                    if (n % 2 === 1 && c === currToken[0]) yield ret(false);
                }
                else if (type === RawTokenKind.Oct) {
                    if (currToken === '0') {
                        if (c === 'b') type = RawTokenKind.Bin;
                        else if (c === 'x') type = RawTokenKind.Hex;
                        else if (c === '.' && Chars.digit(prev)) type = RawTokenKind.Float;
                        else if (!Chars.octal(c)) yield ret();
                    }
                    else if (c !== '0') yield ret();
                }
                else if (type === RawTokenKind.Dec) {
                    if (c === '.' && Chars.digit(prev)) type = RawTokenKind.Float;
                    else if (!Chars.digit(c)) yield ret();
                }
                else if (type === RawTokenKind.Float) { if (!Chars.digit(c)) yield ret(); }
                else if (type === RawTokenKind.Hex)  { if (!Chars.hex(c)) yield ret(); }
                else if (type === RawTokenKind.Bin)  { if (!Chars.anyOf(c, "01")) yield ret(); }
                else if (type === RawTokenKind.Identifier) { if (!Chars.alphanumeric(c) && c !== '_') yield ret(); }
                else if (type === RawTokenKind.Operator) {
                    if (currToken === '/' && c === '/') comment = true, type = RawTokenKind.None;
                    else if (currToken === '/' && c === '*') multicomment = true, type = RawTokenKind.None;
                    else if (!Operator.find(currToken + c)) yield ret();
                }
                else if (Chars.anyOf(c, " \t\n\r")) continue;
                else {
                    if (c === '0') type = RawTokenKind.Oct;
                    else if (Chars.digit(c)) type = RawTokenKind.Dec;
                    else if (Chars.alphanumeric(c) || c === '_') type = RawTokenKind.Identifier;
                    else if (Chars.anyOf(c, "+-/*%=!&|^(){}[];.,<>!:~?")) type = RawTokenKind.Operator;
                    else if (c === '"') type = RawTokenKind.String;
                    else if (c === '\'') type = RawTokenKind.Char;
                    else throw new Message("Unrecognized character.", new Location(filename, line, start, 1, i));

                    repeat = true, currToken = '', start = currStart, line = currLine, codeStart = i;
                    continue;
                }
            } while (repeat);

            currStart++, i++;
            if (c === '\n') currLine++, currStart = 0;
            prev = c, currToken += c;
        }

        if (type === RawTokenKind.String) {
            throw new Message("Unterminated string literal.", new Location(filename, line, start, i - codeStart, codeStart));
        }
        if (type === RawTokenKind.Char) {
            throw new Message("Unterminated char literal.", new Location(filename, line, start, i - codeStart, codeStart));
        }
        if (type != RawTokenKind.None) yield ret();
    }
}
