export function arrcmp<T>(a: ArrayLike<T>, b: ArrayLike<T>, cmpFunc = (a: T, b: T) => a === b) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (!cmpFunc(a[i], b[i])) return false;
    }

    return true;
}