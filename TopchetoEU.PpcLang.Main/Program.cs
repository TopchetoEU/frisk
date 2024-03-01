using System.Text;
using TopchetoEU.PpcLang.Compiler;
using TopchetoEU.PpcLang.Compiler.Parsing;
using TopchetoEU.PpcLang.Compiler.Parsing.Definitions;
using TopchetoEU.PpcLang.Compiler.Tree;
using TopchetoEU.PpcLang.Utils;

var code = new StringBuilder();

while (true) {
    var line = Console.ReadLine();
    if (line == null || line == "") break;
    code.AppendLine(line);
}

var messages = new MsgStack();
var tokens = Token.ParseMany(messages, "<stdio>", code.ToString());

//foreach (var item in tokens) {
//    Console.WriteLine("({0}) {1}", item.Location, item);
//}

Reader<TypeName> type = (ctx) => {
    int n = 0;
    if (!ctx.Read(Readers.ReadNamespace, out var nmsp))
        return ctx.Fail(false, nmsp, "Expected a type");
    var loc = nmsp.Result.Location;
    while (ctx.Read(Readers.ReadOperator, Operator.Multiply, out var star)) {
        n++;
        loc = loc.Intersect(star.Result.Location);
    }

    return ctx.Success(new TypeName(nmsp.Result.Value, n, loc));
};

var parser = new GlobalReader();
var exp = new ExpressionReader(type);

exp.Segments.Add(exp.ReadVariable);

exp.Segments.Add(exp.ReadAssign);
exp.Segments.Add(exp.ReadTernary);

exp.Segments.Add(exp.ReadLazyOr);
exp.Segments.Add(exp.ReadLazyAnd);

exp.Segments.Add(exp.ReadOr);
exp.Segments.Add(exp.ReadXor);
exp.Segments.Add(exp.ReadAnd);

exp.Segments.Add(exp.ReadEquality);
exp.Segments.Add(exp.ReadComparasion);
exp.Segments.Add(exp.ReadShift);

exp.Segments.Add(exp.ReadAdditive);
exp.Segments.Add(exp.ReadMultiplicative);

exp.Segments.Add(exp.ReadPostfix);
exp.Segments.Add(exp.ReadPrefix);

exp.Segments.Add(exp.ReadString);
exp.Segments.Add(exp.ReadInt);
exp.Segments.Add(exp.ReadParens);
exp.Segments.Add(exp.ReadCall);
exp.Segments.Add(exp.ReadCast);

parser.Definitions.Add(new FieldReader(type, exp.Read).Read);
parser.Definitions.Add(new ExportReader(parser.Definitions.Read).Read);
if (new ReadContext(messages, tokens).Read(parser.Read, out var res)) {
    Console.WriteLine(res.Result!);
}
else if (!res) messages.Push(res.Error);

messages.Print(Console.Out, MessageLevel.Debug, true);
