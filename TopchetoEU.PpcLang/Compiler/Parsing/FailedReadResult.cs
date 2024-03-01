using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing;

public class FailedReadResult {
    public ErrorMessage Message { get; }
    public bool Fatal { get; }

    internal FailedReadResult(bool fatal, ErrorMessage msg) {
        Fatal = fatal;
        this.Message = msg;
    }
    internal static FailedReadResult Inherit(bool fatal, ErrorMessage? parent, ErrorMessage child) {
        if (parent == null) return new(fatal, child);
        else return new(fatal, parent.Inherit(child));
    }

    public static implicit operator bool(FailedReadResult _) => false;
}
