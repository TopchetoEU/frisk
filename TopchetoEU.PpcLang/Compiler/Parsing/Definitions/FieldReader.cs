using TopchetoEU.PpcLang.Compiler.Parsing.Tree;
using TopchetoEU.PpcLang.Compiler.Tree;

namespace TopchetoEU.PpcLang.Compiler.Parsing.Definitions;

public class FieldReader {
    public Reader<TypeName> TypeReader { get; set; }
    public Reader<IExpression> ExpressionReader { get; set; }

    public ReadResult<Field> Read(ReadContext ctx) {
        if (!ctx.Read(Readers.ReadIdentifier, out var name)) return ctx.Fail(false, name, "Expected a field");
        TypeName? type = null;
        IExpression? val = null;

        if (ctx.Read(Readers.ReadOperator, Operator.Colon)) {
            if (!ctx.Read(TypeReader, out var typeRes)) return ctx.Fail(false, typeRes, "Expected a field");
            type = typeRes;
        }
        if (ctx.Read(Readers.ReadOperator, Operator.Assign)) {
            if (!ctx.Read(ExpressionReader, out var expRes)) return ctx.Fail(type != null, expRes, type != null ? "Incorrect field statement" : "Expected a field");
            val = expRes.Result;
        }

        if (type == null && val == null) return ctx.Fail(false, "Expected a field");
        if (!ctx.Read(Readers.ReadOperator, Operator.Semicolon, out var semicolon)) return ctx.Fail(true, semicolon, "Incorrect field statemnt");

        return ctx.Success(new Field(name.Result.Value, type, val, ctx.Location));
    }

    public FieldReader(Reader<TypeName> typeReader, Reader<IExpression> expressionReader) {
        TypeReader = typeReader;
        ExpressionReader = expressionReader;
    }
}
