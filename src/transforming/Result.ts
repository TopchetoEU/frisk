import { Node } from "../Node";

export interface SuccessResult {
    type: 'val';
    nodes: Node[];
}
export interface ErrorResult {
    type: 'err';
    loc: string;
    msg: string;
    fatal: boolean;
}
export interface FailResult {
    type: 'fail';
}

export type Result = ErrorResult | FailResult | SuccessResult;

export namespace Result {
    export function val(...nodes: Node[]): SuccessResult {
        return { type: 'val', nodes };
    }
    export function err(loc: string, msg: string, fatal = false): ErrorResult {
        return { type: 'err', loc, msg, fatal };
    }
    export const fail: FailResult = Object.freeze({ type: 'fail' });
}

