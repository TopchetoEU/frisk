using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing;

public class ArgumentChoiceReader<T, ArgT> {
    private readonly List<ArgumentReader<T, ArgT>> readers = new();
    public string Name { get; }

    public void Add<T2>(ArgumentReader<T2, ArgT> reader) where T2: T {
        readers.Add(reader.Cast<T2, T, ArgT>());
    }
    public void Add<T2>(Reader<T2> reader) where T2 : T {
        readers.Add(reader.Cast<T2, T, ArgT>());
    }

    public ReadResult<T> Read(ReadContext ctx, ArgT arg) {
        if (ctx.Ended)
            return ctx.Fail(false, "Expected " + Name);

        var errs = new List<ErrorMessage?>();

        for (var i = readers.Count - 1; i >= 0; i--) {
            if (ctx.Read(readers[i], arg, out var res)) return ctx.Success(res)!;
            else if (res.Fatal) errs.Add(res.Error);
        }

        if (errs.Any(v => v != null)) return ctx.Fail(true, new($"{errs.Count} error(s) occured with {Name}", ctx.Location, errs));
        else return ctx.Fail(false, "Expected " + Name);
    }

    public ArgumentChoiceReader(string name) {
        Name = name;
    }
}
