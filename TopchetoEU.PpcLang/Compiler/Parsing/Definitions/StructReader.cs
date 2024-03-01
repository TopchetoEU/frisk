using TopchetoEU.PpcLang.Compiler.Parsing.Tree;
using TopchetoEU.PpcLang.Compiler.Tree;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing.Definitions;

public interface IStructMember: IDefinition, IExportableDefinition {

}

public class StructReader {
    public ArgumentChoiceReader<IStructMember, IEnumerable<Namespace>> MemberReader { get; }
    public Reader<TypeName> TypeReader { get; }
    public Reader<IExpression> ExpressionReader { get; }

    public ReadResult<Field> Read(ReadContext ctx) {
        if (!ctx.Read(Readers.ReadIdentifier, "struct", out var structKw)) return ctx.Fail(false, structKw, "Expected a struct");
        if (!ctx.Read(Readers.ReadIdentifier, out var name)) return ctx.Fail(true, name, "Incorrect struct");
        if (!ctx.Read(Readers.ReadOperator)) return ctx.Fail(true, name, "Incorrect struct");

        return ctx.Fail(false, "can't be bothered lol");

        //if (ctx.Read(Readers.ReadOperator, Operator.Colon)) {
        //    if (!ctx.Read(TypeReader, out var typeRes)) return ctx.Fail(false, typeRes, "Expected a field");
        //    type = typeRes;
        //}
        //if (ctx.Read(Readers.ReadOperator, Operator.Assign)) {
        //    if (!ctx.Read(ExpressionReader, out var expRes)) return ctx.Fail(type != null, expRes, type != null ? "Incorrect field statement" : "Expected a field");
        //    val = expRes.Result;
        //}

        //if (type == null && val == null) return ctx.Fail(false, "Expected a field");
        //if (!ctx.Read(Readers.ReadOperator, Operator.Semicolon, out var semicolon)) return ctx.Fail(true, semicolon, "Incorrect field statemnt");

        //return ctx.Success(new Field(name.Result.Value, type, val, ctx.Location));
    }

    public StructReader(Reader<TypeName> typeReader, Reader<IExpression> expressionReader) {
        TypeReader = typeReader;
        ExpressionReader = expressionReader;
    }
}
