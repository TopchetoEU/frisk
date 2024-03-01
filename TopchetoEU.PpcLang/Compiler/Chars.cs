namespace TopchetoEU.PpcLang.Compiler;

public static class Chars {
    public static bool IsDigit(this char c) {
        return c >= '0' && c <= '9';
    }
    public static bool IsOctal(this char c) {
        return c >= '0' && c <= '7';
    }
    public static bool IsHex(this char c) {
        return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
    }

    public static bool IsLower(this char c) {
        return c >= 'a' && c <= 'z';
    }
    public static bool IsUpper(this char c) {
        return c >= 'A' && c <= 'Z';
    }
    public static bool is_alphanumeric(this char c) {
        return c.IsLower() || c.IsUpper() || c.IsDigit();
    }

    public static bool IsAny(this char c, string chars) {
        var res = chars.IndexOf(c) != -1;
        return res;
    }
    public static bool is_operator(this char c) {
        return IsAny(c, "=!<>+-*/%&|^?:,.(){}[];~");
    }
}
