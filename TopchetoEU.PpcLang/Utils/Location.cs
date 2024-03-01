namespace TopchetoEU.PpcLang.Utils;

public readonly record struct Location(string? Filename, int Line = -1, int Start = -1, int Length = -1, int CodeStart = -1) {
    public static readonly Location None = new();

    public Location SetLength(int val) {
        return new(Filename, Line, Start, val, CodeStart);
    }
    public Location Next(int n) {
        return new(Filename, Line, Start + Length, n, CodeStart + Length);
    }

    private Location FixLocation() {
        int line = Math.Max(0, Line);
        int start = Math.Max(0, Start);
        int length = Math.Max(0, Length);
        int codestart = Math.Max(0, CodeStart);

        return new(Filename, line, start, length, codestart);
    }

    public Location Intersect(Location other) {
        if (this.CodeStart == -1 || other.CodeStart == -1) return None;

        Location a = this.FixLocation();
        Location b = other.FixLocation();

        if (a.CodeStart > b.CodeStart)
            return other.Intersect(this);

        int a_end = a.CodeStart + a.Length;
        int b_end = b.CodeStart + b.Length;
        int len = a.Length;

        if (a_end < b_end) {
            len += b_end - a_end;
        }

        return new(a.Filename, a.Line, a.Start, len, a.CodeStart);
    }
    public static Location Intersect(Location a, Location b) => a.Intersect(b);

    public override string ToString() {
        string res = "";

        if (Filename != null) {
            res += Filename;
        }
        if (Line + 1 != 0) {
            if (res.Length != 0) res += ':';
            res += Line + 1;
        }
        if (Start + 1 != 0) {
            if (res.Length != 0) res += ':';
            res += Start + 1;
        }
        if (Length + 1 != 0) {
            res += "(" + Length + ")";
        }

        return res;
    }

    public Location(int line = -1, int start = -1, int length = -1, int codeStart = -1) : this(null, line, start, length, codeStart) { }
}
