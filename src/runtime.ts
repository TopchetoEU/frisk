export type Int = bigint;
export type Str = string;
export type NativeFunc = (ctx: Context, ...args: Value[]) => Generator<[ctx: Context, func: Value], Value, Value>;
export type Obj<T extends string = string> = [type: T, ...Value[]];
export function Obj<T extends string>(type: T, ...args: Value[]): Obj<T> {
    return [type, ...args];
}
export type Void = undefined | void;

export type Value = Int | Str | Obj | NativeFunc | Void;

export type Context = Value;
export namespace Context {
    export function of(obj: Record<string, Value>): NativeFunc {
        return function *(ctx, key) {
            if ((typeof key === "bigint" || typeof key === "string") && String(key) in obj) {
                const res = obj[String(key)];

                if (typeof res === "function") return ["val", res.bind(obj)];
                else return ["val", res];
            }
            else return ["err", `No variable ${key}`];
        };
    }
    export function args(func: Value, ...args: Value[]): NativeFunc {
        return function *(ctx, key) {
            if (typeof key === "bigint") {
                if (key === -1n) return func;
                return args[Number(key)];
            }

            else return ["err", "Invalid key"];
        }
    }
    export function chain(...contexts: Context[]): Value {
        return function *(ctx, key) {
            let err = Obj("err", `No variable ${key}`);
            for (const curr of contexts) {
                const res = yield *call(curr, curr, [key]);
                if (isErr(res)) {
                    err = res;
                    continue;
                }
                if (isObj(res, "val")) return res[1];
                else return res;
            }
            return err;
        }
    }
    export function *get(ctx: Context, key: Value): ReturnType<NativeFunc> {
        const res = yield *call(ctx, ctx, [key]);

        if (Array.isArray(res)) {
            if (res[0] === "val") return res[1];
            else if (res[0] === "err") return res;
        }
        else return res;
    }
}

export function exec(gen: ReturnType<NativeFunc>): Value {
    const stack: ReturnType<NativeFunc>[] = [gen];
    let prevVal: [] | [Value] = [];

    while (true) {
        const gen = stack.pop();
        if (gen == null) return prevVal[0];
        const genNext = gen.next(...prevVal);

        if (genNext.done) prevVal = [genNext.value];
        else {
            const [ctx, val] = genNext.value;
            stack.push(gen);

            if (isObj(val, "call")) {
                stack.push((function *() {
                    const func = yield *Context.get(ctx, val[1]);
                    return yield *call(ctx, func, val.slice(2));
                })());
            }
            else prevVal = [val];
        }
    }
}
export function call(ctx: Context, func: Value, args: Value[]): ReturnType<NativeFunc> {
    if (typeof func === "function") return func(ctx, ...args);
    else return (function *() {
        return yield [Context.chain(function *(ctx, key) {
            if (typeof key === "bigint") {
                if (key === -1n) return func;
                if (Number(key) in args) return args[Number(key)];
            }

            return ["err", "Invalid key"];
        }, ctx), func];
    })();
}
export function isErr(val: Value): val is Obj<"err"> {
    return Array.isArray(val) && val[0] === "err";
}
export function isObj<T extends string>(val: Value, type?: T): val is Obj<T> {
    if (!Array.isArray(val)) return false;
    return type == null|| val[0] === type;
}
export function type(val: Value) {
    if (val == null) return "void";
    if (typeof val === "bigint") return "int";
    if (typeof val === "string") return "str";
    if (typeof val === "function") return "native";
    return val[0];
}

export function serialize(val: Value): Uint8Array {
    const res: number[] = [];

    if (val == null) return new Uint8Array([0]);
    else if (typeof val === "function") throw new Error("Native values not serializable");
    else if (typeof val === "bigint") {
        res.push(1);

        while (true) {
            let cont = Number((val & ~0x7Fn) !== 0n) << 7;
            res.push(cont | Number(val & 0xFFn));
            val >>= 7n;
            if (!cont) break;
        }
    }
    else if (typeof val === "string") {
        res.push(2);
        res.push(...new TextEncoder().encode(val));
        res.splice(1, 0, ...serialize(BigInt(val.length)).slice(1));
    }
    else if (val[0] === "ref") throw new Error("References not serializable");
    else if (val[0] === "call") {
        res.push(3);
        res.push(...serialize(BigInt(val.length - 1)).slice(1));
        for (const el of val.slice(1)) res.push(...serialize(el));
    }
    else {
        res.push(4);
        res.push(...serialize(BigInt(val.length - 1)).slice(1));
        res.push(...serialize(val[0]).slice(1));
        for (const el of val.slice(1)) res.push(...serialize(el));
    }

    return new Uint8Array(res);
}

export function deserialize(data: Uint8Array) {
    function internal(offset = 0, type?: number): [val: Value, n: number] {
        let n = 0;
    
        switch (type ?? data[offset + n++]) {
            case 1: {
                let val = 0n;
    
                while (true) {
                    const byte = data[offset + n++];
                    const cont = (byte & 0x80) !== 0;
                    val <<= 7n;
                    val |= BigInt(byte & 0x7F);
    
                    if (!cont) break;
                }
    
                return [val, n];
            }
            case 2: {
                const [size, sizeN] = internal(offset + n, 1);
                n += sizeN;
    
                const str = data.slice(offset + n, offset + (n += Number(size)));
                return [new TextDecoder().decode(str), n];
            }
            case 3: {
                const [size, sizeN] = internal(offset + n, 1) as [bigint, number];
                n += sizeN;
    
                const res = Obj("call");
                for (let i = 0n; i < size; i++) {
                    const [val, valN] = internal(offset + n);
                    n += valN;
                    res.push(val);
                }
    
                return [res, n];
            }
            case 4: {
                const [size, sizeN] = internal(offset + n, 1) as [bigint, number];
                n += sizeN;
    
                const [type, typeN] = internal(offset + n, 2);
                n += typeN;
    
                const res: Obj = [type as string];
                for (let i = 0n; i < size; i++) {
                    const [val, valN] = internal(offset + n);
                    n += valN;
                    res.push(val);
                }
    
                return [res, n];
            }
            default: return [undefined, 1];
        }
    }

    return internal()[0];
}