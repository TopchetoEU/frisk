import { Context } from "../parsing";

export class Source {
    private _lineStarts = [ 0 ];

    public loc(i: number) {
        let left = 0;
        let right = this._lineStarts.length - 1;
        let row = this._lineStarts.length - 1;
        let start = this._lineStarts.at(-1)!;

        while (i != null && left <= right) {
            const currRow = Math.floor((left + right) / 2);
            const currStart = this._lineStarts[currRow];

            if (currStart <= i) {
                row = currRow;
                start = currStart;
                left = currRow + 1;
            }
            else right = currRow - 1;
        }

        if (row == null || start == null) return this.filename;

        const col = i - start;
        return this.filename + ":" + (row + 1) + ":" + (col + 1);
    }
    public nextStart(i: number) {
        let left = 0;
        let right = this._lineStarts.length - 1;
        let row = this._lineStarts.length - 1;

        while (i != null && left <= right) {
            const currRow = Math.floor((left + right) / 2);

            if (this._lineStarts[currRow] <= i) {
                row = currRow;
                left = currRow + 1;
            }
            else right = currRow - 1;
        }

        if (row == null) return i;
        else return this._lineStarts[row] ?? i;
    }

    public at(i: number): string | undefined {
        return this.source[i];
    }

    public constructor(
        public readonly source: string,
        public readonly filename: string,
        public readonly ctx: Context
    ) {
        for (let i = 0; i  < source.length; i++) {
            if (source[i] === '\n') this._lineStarts.push(i + 1);
        }
    }
}
