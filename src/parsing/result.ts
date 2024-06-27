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

export type Result<T> = SuccessResult<T> | FailResult | ErrorResult;

export namespace Result {
    export function val<T>(val: T, n: number): SuccessResult<T> {
        return { type: 'res', n, val };
    }
    export function err(msg: string, loc: string, ...others: Result<any>[]): ErrorResult {
        for (const other of others) {
            if (other.type === 'err') return other;
        }

        return { type: 'err', n: 0, msg, loc };
    }
    export const fail: FailResult = { type: 'fail', n: 0 };

}