import { Consumer } from "./Consumer.ts";
import { Message } from "../utils/Message.ts";
import { Namespace } from "../utils/Namespace.ts";
import { Operator } from "../utils/Operator.ts";
import { Node } from "./Node.ts";

export class ParseResult<T> {
    public get failed() { return this.val == null; }
    public get succeeded() { return this.val != null; }

    public constructor(
        public readonly n = 0,
        public readonly val?: T,
        public readonly msg?: Message,
    ) { }

    public error(msg?: Message) {
        if (this.msg) {
            if (msg) return ParseResult.error(msg.push(this.msg));
            else return ParseResult.error(this.msg);
        }
        else {
            if (msg) return ParseResult.error(msg);
            else return ParseResult.fail;
        }
    }

    public map<T2>(mapper: (v: T, n: number) => T2) {
        if (this.succeeded) return ParseResult.res(mapper(this.val!, this.n), this.n);
        else return this as any as ParseResult<T2>;
    }

    public static res<T>(val: T, n: number) {
        return new ParseResult<T>(n, val);
    }
    public static error(msg: Message): ParseResult<never> {
        return new ParseResult(0, undefined!, msg);
    }

    public static first<T>(...els: (ParseResult<T> | (() => ParseResult<T>))[]): ParseResult<T> {
        let msg: Message | undefined;

        for (let el of els) {
            if (!('n' in el)) el = el();
            if (el.succeeded) return el;
            if (el.msg) return el;
        }

        return msg == null ? ParseResult.fail : ParseResult.error(msg);
    }
}

export namespace ParseResult {
    export const fail = new ParseResult<never>();
}

export function loc(c: Consumer, i: number, len?: number) {
    if (i < 0) return c.get(0)?.location.setLength(1);

    if (len != null) return c.get(i)?.location.next(len);
    else return c.get(i)?.location;
}
export function errLoc(c: Consumer, i: number, n: number = 0) {
    return loc(c, i + n - 1, 1);
}

export function parseIdentifier(c: Consumer, i: number, id?: Namespace) {
    let n = 1;
    const segs: string[] = [];

    {
        const tok = c.get(i);
        if (tok?.identifier == null) return ParseResult.fail;
        segs.push(tok.identifier);
    }

    while (true) {
        if (!c.get(i + n)?.isOperator(Operator.DoubleColon)) break;
        n++;

        const id = c.get(i + n);
        if (id?.identifier == null) return ParseResult.error(new Message("Expected an identifier after '::'", errLoc(c, i, n)));
        n++;
        segs.push(id.identifier);
    }

    const res = Namespace(segs);

    if (id != null && !Namespace.equal(res, id)) return ParseResult.error(new Message(`Expected '${id}'`, errLoc(c, i)));

    return ParseResult.res(res, n);
}
export function parseDelimList<T>(
    c: Consumer, i: number,
    open: Operator, close: Operator, delim: Operator | undefined,
    elName: string, exec: (c: Consumer, i: number) => ParseResult<T>
) {
    let n = 0;

    const res: T[] = [];

    if (!c.get(i + n)?.isOperator(open)) return ParseResult.fail;
    if (!c.get(i + n + 1)?.isOperator(close)) {
        while (true) {
            n++;
            const exp = exec(c, i + n);
            if (exp.failed) {
                if (delim != null || exp.msg != null) {
                    if (res.length === 0) return exp.error(new Message(`Expected ${elName} or a ${Operator.stringify(close)}`, loc(c, i + n)));
                    else return exp.error(new Message(`Expected ${elName}`, loc(c, i + n)));
                }
                else if (c.get(i + n)?.isOperator(close)) break;
                else return ParseResult.error(new Message(`Expected a ${Operator.stringify(close)}`, errLoc(c, i, n)));
            }
            else res.push(exp.val!);
            n += exp.n;

            if (delim != null && c.get(i + n)?.isOperator(delim)) {
                if (c.get(i + n + 1)?.isOperator(close)) {
                    n++;
                    break;
                }
                else continue;
            }
            else if (c.get(i + n)?.isOperator(close)) break;
            else if (delim == null) {
                n--;
                continue;
            }
            else return ParseResult.error(new Message(`Expected a ${Operator.stringify(delim)} or a ${Operator.stringify(close)} after ${elName}`, errLoc(c, i, n)));
        }
    }
    else n++;

    return ParseResult.res(res, n + 1);
}

export class AsmNode implements Node {
    public constructor(public readonly data: string) { }

    public toJS() { return this.data; }

    public static parse(c: Consumer, i: number) {
        if (!c.get(i)?.isIdentifier("asm")) return ParseResult.fail;

        if (!c.get(i + 1)?.stringLiteral) return ParseResult.fail;

        return ParseResult.res(new AsmNode(String.fromCodePoint(...c.get(i + 1)?.stringLiteral!)), 2);
    }
}