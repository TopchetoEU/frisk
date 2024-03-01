using System.Collections.Immutable;
using TopchetoEU.PpcLang.Compiler.Tree;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing;

public class GlobalReader {
    public ArgumentChoiceReader<IDefinition, IEnumerable<Namespace>> Definitions { get; } = new("definition");

    private ReadResult<Located<Namespace>> ReadNamespaceStm(ReadContext ctx, string identifier) {
        var id = ctx.Read(Readers.ReadIdentifier, identifier);
        if (!id) return ctx.Fail(false, id, $"Expected {identifier} statemnt");

        if (!ctx.Read(Readers.ReadNamespace, out var nmsp)) return ctx.Fail(true, nmsp, $"Incorrect {identifier} statemnt");
        if (!ctx.Read(Readers.ReadOperator, Operator.Semicolon, out var semicolon)) return ctx.Fail(true, semicolon, $"Incorrect {identifier} statemnt");

        return ctx.Success(nmsp.Result);
    }

    public ReadResult<Global> Read(ReadContext ctx) {
        if (ctx.Ended) return ctx.Success(new Global(new()));

        if (ctx.Read(ReadNamespaceStm, "namespace", out var nmspRes).Fatal) return ctx.Fail(true, nmspRes);
        var nmsp = nmspRes.GetValue(new(new Namespace(), Location.None));
        var imports = new List<Located<Namespace>>();
        var defs = new List<IDefinition>();

        while (true) {
            if (ctx.Read(ReadNamespaceStm, "import", out var import)) imports.Add(import);
            else if (import.Fatal) return ctx.Fail(true, import);
            else break;
        }

        var importsArgBuilder = ImmutableList.CreateBuilder<Namespace>();
        importsArgBuilder.Add(nmsp.Value);
        importsArgBuilder.AddRange(imports.Select(v => v.Value));
        var importArg = importsArgBuilder.ToImmutable();

        while (!ctx.Ended) {
            var def = ctx.Read(Definitions.Read, importArg);
            if (def) defs.Add(def.Result);
            else {
                if (def.Fatal) ctx.Messages.Push(def.Error);
                else ctx.Messages.Error("Unexpected token.", ctx.TokenLocation);
                ctx.Consume();
            }
        }

        var res = new Global(nmsp.Value);
        res.Imports.AddRange(imports);
        res.Definitions.AddRange(defs);

        return ctx.Success(res);
    }
}