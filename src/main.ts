import * as fs from "fs";
import { compile, ExpressionParser } from "./parsing";
import { call, Context, deserialize, exec, isErr, isObj, NativeFunc, Obj, serialize, type } from "./runtime";
import { Source } from "./Source";

const nodes = compile(...process.argv.slice(2).map(v => new Source(fs.readFileSync(v).toString(), v)));

const ctx = Context.of({
    *"list::at"(ctx, arr, index) {
        if (!isObj(arr)) return ["err", "First argument must be an object"];
        if (typeof index !== "bigint") return ["err", "Index argument must be an integer"];
        return arr[Number(index)];
    },

    *"list::n"(ctx, arr) {
        if (!isObj(arr)) return ["err", "First argument must be an object"];
        else return BigInt(arr.length - 1);
    },
    *"list::first"(ctx, arr) {
        if (!isObj(arr)) return ["err", "First argument must be an object"];
        if (arr.length === 0) return ["err", "No elements in object"];
        return arr[0];
    },
    *"list::last"(ctx, arr) {
        if (!isObj(arr)) return ["err", "First argument must be an object"];
        if (arr.length === 0) return ["err", "No elements in object"];
        return arr.at(-1);
    },
    *"list::concat"(ctx, ...args) {
        const res = Obj("list");

        for (const arg of args) {
            if (isObj(arg, "list")) res.push(...arg.slice(1));
            else res.push(arg);
        }

        return res;
    },

    *"int::add"(ctx, a: any, b: any) {
        if (typeof a === "bigint" && typeof b === "bigint") return a + b;
    },
    *"int::sub"(ctx, a: any, b: any) {
        if (typeof a === "bigint" && typeof b === "bigint") return a - b;
    },
    *"int::mul"(ctx, a: any, b: any) {
        if (typeof a === "bigint" && typeof b === "bigint") return a * b;
    },
    *"int::div"(ctx, a: any, b: any) {
        if (typeof a === "bigint" && typeof b === "bigint") {
            if (b === 0n) return undefined;
            else return a / b;
        }
    },
    *"int::mod"(ctx, a: any, b: any) {
        if (typeof a === "bigint" && typeof b === "bigint") {
            if (b === 0n) return undefined;
            else return a % b;
        }
    },
    *"int::pow"(ctx, a: any, b: any) {
        if (typeof a === "bigint" && typeof b === "bigint") {
            if (a === 0n && b === 0n) return undefined;
            else return a ** b;
        }
    },

    *"str::concat"(ctx, a: any, b: any) {
        if (typeof a === "string" && typeof b === "string") return a + b;
    },
    *"str::n"(ctx, a) {
        if (typeof a === "string") return BigInt(a.length);
    },

    *"typeof"(ctx, val) {
        return type(val);
    },

    *"at"(ctx, list, i) {
        if (typeof i !== "bigint") return ["err", "Index must be an int"];
        if (!isObj(list)) return ["err", "at may only be used with objects"];
        if (i < 0n || i >= list.length - 1) return ["err", "index is out of range in list"];
        return list[Number(i) + 1];
    },
    *"push"(ctx, list, ...args) {
        if (isObj(list)) return [...list, ...args];
        else return undefined;
    },
    *"get"(ctx, name) {
        return yield *Context.get(ctx, name);
    },
    *"set"(ctx, name, val) {
        return this[name + ""] = val;
    },
    *"new"(ctx, type, ...args) {
        return [type + "", ...args];
    },
    *"exec"(ctx, node) {
        return yield [ctx, node];
    },
    *"invoke"(ctx, func, ...args) {
        func = yield [ctx, func];
        if (isErr(func)) return func;

        for (let i = 0; i < args.length; i++) {
            args[i] = yield [ctx, args[i]];
            if (isErr(args[i])) return args[i];
        }

        return yield *call(ctx, func, args);
    },
    *"print"(ctx, ...args) {
        console.log(...args);
    },
    *"capsule"(ctx, val) { return val; },

    *"op::comp"(ctx, ...args) {
        let res;

        for (const arg of args) {
            res = yield [ctx, arg];
            if (isErr(res)) return res;
        }

        return res;
    },

    *"ref"(ctx, val) {
        return ["ref", val];
    },
    *"ref::get"(ctx, ref) {
        if (!isObj(ref, "ref")) return ["err", "ref::get may only be used on references"];
        return ref[1];
    },
    *"ref::set"(ctx, ref, val) {
        if (!isObj(ref, "ref")) return ["err", "ref::set may only be used on references"];
        return ref[1] = val;
    },

    *"map"(ctx) {
        const map = new Map();
        return ["map",
            function *(ctx, key) { return map.get(key); },
            function *(ctx, key, val) { map.set(key, val); return val; },
            function *(ctx, key) { return map.has(key) ? 1n : 0n; },
            function *(ctx, key) { map.delete(key); },
        ];
    },
});

const res = exec!((function *() { return yield [ctx, nodes]; })());
debugger;
