using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing;

public class ReadResult<T> {
    private enum ReadResultType {
        Success,
        Fail,
        Fatal,
    }

    private readonly ReadResultType type;
    private readonly T? result;
    private readonly ErrorMessage? message;

    public bool Fatal => type == ReadResultType.Fatal;
    public T Result {
        get {
            if (!this) throw new InvalidOperationException("Can't get the result of a failed ReadResult.");
            else return result!;
        }
    }
    public ErrorMessage Error {
        get {
            if (this) throw new InvalidOperationException("Can't get the error of a successful ReadResult.");
            else return message!;
        }
    }

    public T GetValue(T defVal) {
        if (this)
            return Result!;
        else
            return defVal;
    }

    internal ReadResult(T result) {
        this.type = ReadResultType.Success;
        this.result = result;
    }
    internal ReadResult(bool fatal, ErrorMessage msg) {
        this.type = fatal ? ReadResultType.Fatal : ReadResultType.Fail;
        this.message = msg;
    }

    public static implicit operator bool(ReadResult<T> result) => result.type == ReadResultType.Success;
    public static implicit operator T(ReadResult<T> result) => result.Result;
    public static implicit operator ReadResult<T>(FailedReadResult res) => new(res.Fatal, res.Message);
}
