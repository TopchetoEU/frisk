using System.Text;
using TopchetoEU.PpcLang.Compiler.Parsing.Definitions;
using TopchetoEU.PpcLang.Compiler.Tree;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing.Tree;

public record Field(string Name, TypeName? Type, IExpression? Value, Location Location): IExportableDefinition {
    public string ToString(int indent) {
        var ss = new StringBuilder()
            .Append("Field@")
            .Append(Location.ToString())
            .AppendLine(":");

        if (Type != null) ss
            .Append('\t', indent + 1)
            .Append("Type: ")
            .AppendLine(Type.ToString());
        if (Value != null) ss
            .Append('\t', indent + 1)
            .Append("Value: ")
            .AppendLine(Value.ToString(indent + 1));
        
        return ss.ToString().TrimEnd();
    }
}
