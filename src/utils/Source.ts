export class Source {
    private _lineStarts = [ 0 ];

    public loc(i: number) {
        let left = 0;
        let right = this._lineStarts.length - 1;
        let row = this._lineStarts.length - 1;
        let start = this._lineStarts.at(-1)!;

        while (i != null && left <= right) {
            const curr_row = Math.floor((left + right) / 2);
            const curr_start = this._lineStarts[curr_row];

            if (curr_start <= i) {
                row = curr_row;
                start = curr_start;
                left = curr_row + 1;
            }
            else right = curr_row - 1;
        }

        if (row == null || start == null) return this.filename;

        const col = i - start;
        return this.filename + ":" + (row + 1) + ":" + (col + 1);
    }

    public at(i: number): string | undefined {
        return this.source[i];
    }

    public constructor(
        public readonly filename: string, public readonly source: string
    ) {
        for (let i = 0; i  < source.length; i++) {
            if (source[i] === '\n') this._lineStarts.push(i + 1);
        }
    }
}
