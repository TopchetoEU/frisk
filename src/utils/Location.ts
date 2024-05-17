export class Location {
    public static readonly None = new Location();

    public constructor (
        public filename?: string,
        public line?: number,
        public start?: number,
        public length?: number,
        public codeStart?: number
    ) { }

    private fixLocation() {
        return new Location(this.filename, this.line ?? 0, this.start ?? 0, this.length ?? 0, this.codeStart ?? 0);
    }

    public setLength(val: number) {
        return new Location(this.filename, this.line, this.start, val, this.codeStart);
    }
    public next(n = 1) {
        let start = this.start, codeStart = this.codeStart;

        if (start !== undefined && this.length !== undefined) start += this.length;
        if (codeStart !== undefined && this.length !== undefined) codeStart = this.length;

        return new Location(this.filename, this.line, start, n, codeStart);
    }
    public intersect(other: Location): Location {
        if (this.codeStart === -1 || other.codeStart === -1) return Location.None;

        const a = this.fixLocation();
        const b = other.fixLocation();

        if (a.codeStart! > b.codeStart!) return other.intersect(this);

        const aEnd = a.codeStart! + a.length!;
        const bEnd = b.codeStart! + b.length!;
        let len = a.length!;

        if (aEnd < bEnd) len += bEnd - aEnd;

        return new Location(a.filename, a.line, a.start, len, a.codeStart);
    }
    public toString() {
        const res: string[] = [];

        if (this.filename != null) res.push(this.filename);
        if (this.line != null) res.push(String(this.line + 1));
        if (this.start != null) res.push(String(this.start + 1));

        return res.join(':') + (this.length === undefined ? '' : `(${this.length})`);
    }
}