using System.Text;
using TopchetoEU.PpcLang.Compiler.Tree;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing.Definitions;

public interface IExportableDefinition: IDefinition { }
public record struct Export(IExportableDefinition Definition, Location Location): IDefinition {
    public string ToString(int indent = 0) {
        return new StringBuilder("Export@")
            .Append(Location.ToString())
            .Append(": ")
            .Append(Definition.ToString(indent))
            .ToString();
    }
}

public class ExportReader {
    public ArgumentReader<IExportableDefinition, IEnumerable<Namespace>> DefinitionReader { get; set; }

    public ReadResult<Export> Read(ReadContext ctx, IEnumerable<Namespace> imports) {
        if (!ctx.Read(Readers.ReadIdentifier, "export", out var exp)) return ctx.Fail(false, exp);
        if (!ctx.Read(DefinitionReader, imports, out var def)) return ctx.Fail(true, def, "Incorrect export");
        if (def.Result is IExportableDefinition expDef) return ctx.Success(new Export(expDef, ctx.Location));
        else return ctx.Fail(true, "'export' modifier may be used only for exportable definitions");
    }
}
