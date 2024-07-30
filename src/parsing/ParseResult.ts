import { Message } from "../utils/Message";

export interface SuccessResult<T> {
    type: 'res';
    val: T;
    n: number;
} 
export interface FailResult {
    type: 'fail';
    n: 0;
}
export interface ErrorResult {
    type: 'err';
    loc: string;
    msg: string;
    n: 0;
}

export type ParseResult<T> = SuccessResult<T> | FailResult | ErrorResult;

export namespace ParseResult {
    export function val<T>(val: T, n: number): SuccessResult<T> {
        return { type: 'res', n, val };
    }
    export function err(msg: string, loc: string, ...others: ParseResult<any>[]): ErrorResult {
        for (const other of others) {
            if (other.type === 'err') return other;
        }

        return { type: 'err', n: 0, loc, msg };
    }
    export const fail: FailResult = { type: 'fail', n: 0 };

}