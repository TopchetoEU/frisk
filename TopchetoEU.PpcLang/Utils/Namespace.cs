
using System.Collections;
using System.Collections.Generic;
using TopchetoEU.PpcLang.Compiler;

namespace TopchetoEU.PpcLang.Utils;

public readonly struct Namespace: IComparable<Namespace>, IEnumerable<string> {
    private readonly List<string> segments = new();

    public int CompareTo(Namespace other) {
        var a = this;
        var b = other;

        for (int i = 0; i < a.segments.Count && i < b.segments.Count; i++) {
            var cmp = a.segments[i].CompareTo(b.segments[i]);
            if (cmp != 0) return cmp;
        }

        return a.segments.Count.CompareTo(b.segments.Count);
    }
    public override bool Equals(object? obj) {
        return obj is Namespace nmsp && CompareTo(nmsp) == 0;
    }
    public override int GetHashCode() {
        int hash = 19;
        foreach (var item in segments) {
            hash = hash * 31 + item.GetHashCode();
        }
        return hash;
    }
    public override string ToString() => string.Join("::", segments);

    public IEnumerator<string> GetEnumerator() => segments.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    public static bool operator ==(Namespace a, Namespace b) => a.Equals(b);
    public static bool operator !=(Namespace a, Namespace b) => !a.Equals(b);
    public static bool operator <(Namespace a, Namespace b) => a.CompareTo(b) < 0;
    public static bool operator <=(Namespace a, Namespace b) => a.CompareTo(b) <= 0;
    public static bool operator >(Namespace a, Namespace b) => a.CompareTo(b) > 0;
    public static bool operator >=(Namespace a, Namespace b) => a.CompareTo(b) >= 0;

    public Namespace() {
        this.segments = new();
    }
    public Namespace(IEnumerable<string> segments) {
        this.segments.AddRange(segments);
    }
    public Namespace(params string[] segments) {
        this.segments.AddRange(segments);
    }

    public static Namespace operator +(Namespace a, Namespace b) => Join(a, b);
    public static Namespace Join(params Namespace[] namespaces) {
        var res = new List<string>();

        foreach (var item in namespaces) {
            res.AddRange(item);
        }

        return new(res);
    }
}
