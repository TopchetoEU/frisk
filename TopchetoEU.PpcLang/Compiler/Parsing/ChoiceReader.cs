using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing;

public class ChoiceReader<T> {
    private readonly List<Reader<T>> readers = new();
    public string Name { get; }

    public void Add(Reader<T> reader) {
        readers.Add(reader);
    }

    public ReadResult<T> Read(ReadContext ctx) {
        if (ctx.Ended) return ctx.Fail(false, "Expected " + Name);

        var errs = new List<ErrorMessage?>();
        
        for (var i = readers.Count - 1; i >= 0; i--) {
            if (ctx.Read(readers[i], out var res)) return ctx.Success(res)!; 
            else if (res.Fatal) errs.Add(res.Error);
        }

        if (errs.Any(v => v != null)) return ctx.Fail(true, ctx.GetError("Fatal errors encountered").Inherit(errs));
        else return ctx.Fail(false, "Expected " + Name);
    }

    public ChoiceReader(string name) {
        Name = name;
    }
}
