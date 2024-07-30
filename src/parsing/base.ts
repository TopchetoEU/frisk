export type Expression = Call | IntLiteral | StringLiteral;

export namespace Expression {
    export function *iterate(exp: Expression): Generator<Expression, void, unknown> {
        if (exp.type === "call") {
            for (const arg of exp.arguments) {
                yield *iterate(arg);
            }
        }

        yield exp;
    }
}

export interface Call {
    type: "call";
    function: string;
    arguments: Expression[];
}

export interface IntLiteral {
    type: "int";
    value: bigint;
}
export namespace IntLiteral {
    export function bitsize(lit: IntLiteral) {
        let i = 0;
        let val = lit.value;

        do {
            i++;
            val >>= 1n;
        }
        while (val > 0);

        return i;
    }
    export function bytesize(lit: IntLiteral) {
        let i = 0;
        let val = lit.value;

        do {
            i++;
            val >>= 8n;
        }
        while (val > 0);

        return i;
    }
}

export interface StringLiteral {
    type: "str";
    value: Uint16Array;
}
export namespace StringLiteral {
    export function getString(str: StringLiteral) {
        return String.fromCharCode.apply(String, str.value as any);
    }
}

export interface Func {
    type: "func";
    id: string;
    params: string[];
    body: Expression[];
}

export interface Module {
    functions: Record<string, Func>;
}

export function call(name: string, ...args: Expression[]): Call {
    return { type: "call", function: name, arguments: args };
}
export function int(val: bigint): IntLiteral {
    return { type: "int", value: val };
}
export function str(val: Uint16Array): StringLiteral {
    return { type: "str", value: val };
}

export function func(id: string, params: string[], ...body: Expression[]): Func {
    return { type: "func", id, params, body };
}

export function module(funcs: Func[], opts: { checkDuplicates: true }): Module | Set<string>;
export function module(funcs: Func[], opts?: { checkDuplicates?: false }): Module;
export function module(funcs: Func[], { checkDuplicates = true } = {}) {
    const res: Module = { functions: {} };
    const duplicates = new Set<string>();

    for (const func of funcs) {
        if (checkDuplicates && Object.hasOwn(res.functions, func.id)) {
            duplicates.add(func.id);
        }
        else {
            res.functions[func.id] = func;
        }
    }

    if (duplicates.size > 0) return duplicates;
    else return res;
}
