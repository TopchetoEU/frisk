namespace TopchetoEU.PpcLang.Utils;

public readonly struct Located<T> {
    public T Value { get; }
    public Location Location { get; }

    public static bool operator ==(Located<T> a, Located<T> b) {
        if (a.Value is null || b.Value is null) return a.Value is null && b.Value is null;
        return a.Value.Equals(b.Value);
    }
    public static bool operator !=(Located<T> a, Located<T> b) => !(a == b);

    public Located(T value, Location? loc = null) {
        Value = value;
        Location = loc ?? Location.None;
    }
}