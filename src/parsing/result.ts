export class ParseRes<T> {
    public success(): this is ParseRes<T> & { res: T, n: 0 } {
        return this.res != null;
    }
    public failed(): this is ParseRes<never> & { res: undefined, n: 0 } {
        return this.res == null;
    }
    public hasError(): this is ParseRes<never> & { n: 0, msg: string } {
        return this.msg != null;
    }
    public hasAny(): boolean {
        return this.res != null || this.msg != null;
    }

    public constructor(
        public readonly res: T | undefined,
        public readonly n: number,
        public readonly loc: number,
        public readonly msg?: string
    ) { }

    public static val<T>(val: T, n: number) {
        return new ParseRes(val, n, 0);
    }
    public static err(err: string, loc: number, ...others: ParseRes<unknown>[]) {
        for (const other of others) {
            if (other.hasError()) return other as ParseRes<never>;
        }

        return new ParseRes<never>(undefined, 0, loc, err);
    }
    public static readonly fail = new ParseRes<never>(undefined, 0, 0);
}
