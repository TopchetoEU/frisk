export type NamespaceInit = (string | string[])[];
export type NamespaceLike = [ string, ...string[] ];
export type Namespace = NamespaceLike & { toString(): string };

export interface NamespaceConstructor {
    (...segments: NamespaceInit): Namespace;
    new(...segments: NamespaceInit): Namespace;

    equal(a?: Namespace, b?: Namespace): boolean;
}

export const Namespace: NamespaceConstructor = function Namespace(...segments): Namespace {
    const res: string[] = [];

    for (const val of segments) {
        if (Array.isArray(val)) {
            for (const seg of Namespace(...val)) res.push(seg);
        }
        else {
            res.push(
                ...val.split('::')
                .map(v => v.trim())
                .filter(v => v !== '')
            );
        }
    }

    if (res.length === 0) throw new Error("Parsing resulted in an empty namespace.");

    Object.setPrototypeOf(res, proto);

    return res as Namespace;
} as NamespaceConstructor;
export function nmsp(segments: TemplateStringsArray, ...args: any[]) {
    const res: string[] = [];

    res.push(segments[0]);

    for (let i = 1; i < segments.length; i++) {
        res.push(args[i - 1]);
        res.push(segments[i]);
    }

    return new Namespace(res.join(''));
}

const proto = {
    toString(this: Namespace) { return this.join('::'); },
    constructor: Namespace,
};

Object.setPrototypeOf(proto, Array.prototype);

Namespace.equal = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null) return a == null && b == null;

    if (a?.length !== b?.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }

    return true;
};
(Namespace as any).prototype = proto;