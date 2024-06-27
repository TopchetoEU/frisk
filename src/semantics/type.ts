export interface Type {
    readonly name?: string;
    /** Returns a comparable string */
    toComparable(): string;
}

export namespace Type {
    export function equal(a?: Type, b?: Type, nullFalse = false) {
        if (a == null || b == null) {
            if (nullFalse) return false;
            else return a == null && b == null;
        }

        if (a === b) return true;

        return a.toComparable() === b.toComparable();
    }
}

export class PrimitiveType implements Type {
    public constructor(public readonly name?: string | undefined) { }

    toComparable(): string {
        return `P:${this.name}`;
    }
}

export const VoidType: Type = {
    toComparable: () => "void",
    name: "void"
};
