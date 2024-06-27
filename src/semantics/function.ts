// import { Node } from "../parsing";
// import { ArgumentNode } from "../parsing/expression";
// import { Type } from "./type";

// export interface CallError {
//     type: 'error';
//     msg: string;
//     loc: string;
// }
// export interface CallSuccess {
//     type: 'result';
//     node: Node;
//     weight: number;
// }

// export interface Callable {
//     readonly name: string;

//     call(args: (ArgumentNode | undefined)[], retType: Type | undefined): CallSuccess | CallError;
// }

// export interface Converter {
//     convert(val: Node, target: Type): CallSuccess | CallError;
// }

// export class ConverterRegister implements Converter {
//     private _converters = new Set<Converter>();

//     public convert(val: Node, target: Type): CallSuccess | CallError {
//         if (this._converters.size === 0) return { type: 'error', loc: val.loc, msg: "No converters in current context" };

//         const errors: CallError[] = [];
//         let results: CallSuccess[] = [];
//         let weight = Infinity;

//         for (const converter of this._converters) {
//             const res = converter.convert(val, target);
//             if (res.type === 'error') errors.push(res);
//             else if (weight > res.weight) {
//                 results = [ res ];
//                 weight = res.weight;
//             }
//             else if (weight === res.weight) results.push(res);
//         }

//         if (results.length === 0) return { type: 'error', loc: val.loc, msg: errors.map(v => v.loc + ':' + v.msg).join('\n') };
//         else return results[0];
//     }
// }

// export class CallableRegister {
//     private _callables = new Map<string, Set<Callable>>();

//     public register(callable: Callable) {
//         let set = this._callables.get(callable.name);
//         if (set == null) this._callables.set(callable.name, set = new Set());
//         set.add(callable);
//     }
//     public call(name: string, args: ArgumentNode[], callLoc: string) {
//         const callables = this._callables.get(name);
//         if (callables == null) return { loc: callLoc, msg: `No callable '${name}'`, type: 'error' } as CallError;

//         for (const callable of callables) {
//             callable.call()
//         }
//     }
// }

// // export class Overload extends Node {
// //     public constructor(
// //         public loc: string,
// //         public readonly params: Type[],
// //         public readonly retType: Type,
// //         public readonly body: Node
// //     ) { super(loc); }

// //     /**
// //      * Checks whether or not the overload can be called with the given arguments
// //      * @param args The argument to check against
// //      * @returns A number, representing the preference index, or a reason why the arguments don't match
// //      */
// //     public canCall(args: { type: Type, loc: string }[]): OverloadCheckResult {
// //         for (let i = 0; i < this.params.length; i++) {
// //             const target = this.params[i];
// //             const { type: src, loc } = args[i];

// //             if (src == null) return { type: "fail", msg: "Not enough arguments passed" };
// //             if (!Type.equal(src, target)) return { type: "fail", msg: `Type ${src} not assignable to ${target}.` };
// //         }

// //         return { type: "success", pref: 0 };
// //     }
// // }

// // export class Function extends Node {
// //     public constructor(
// //         public loc: string,
// //         public readonly overloads: Overload[],
// //     ) { super(loc); }

// //     public getOverload(args: { type: Type, loc: string }[]) {
// //         for (const overload of this.overloads) { }
// //     }
// // }