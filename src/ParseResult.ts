export type SuccessResult<T> = ["res", n: number, value: T];
export type FailResult = ["fail", n: 0];
export type ErrorResult = ["err", n: 0, loc: string, msg: string];

export type ParseResult<T> = SuccessResult<T> | FailResult | ErrorResult;

export namespace ParseResult {
    export function val<T>(val: T, n: number): SuccessResult<T> {
        return ["res", n, val];
    }
    export function err(msg: string, loc: string, ...others: ParseResult<any>[]): ErrorResult {
        for (const other of others) {
            if (other[0] === "err") return other;
        }

        return ["err", 0, loc, msg];
    }
    export const fail: FailResult = ["fail", 0];
}