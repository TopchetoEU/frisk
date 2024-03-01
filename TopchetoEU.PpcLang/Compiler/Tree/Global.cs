using System.Text;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Tree;

public class Global {
    public Namespace Namespace { get; }
    public List<Located<Namespace>> Imports { get; } = new();
    public List<IDefinition> Definitions { get; } = new();

    public override string ToString() {
        var ss = new StringBuilder();
        ss.AppendLine($"Namespace: {Namespace}");
        ss.AppendLine("Imports:");
        foreach (var import in Imports) {
            ss.AppendLine($"\t{import.Value} @ {import.Location}");
        }
        ss.AppendLine("Definitions:");
        foreach (var def in Definitions) {
            ss.Append('\t').AppendLine(def.ToString(1));
        }
        return ss.ToString();
    }

    public Global(Namespace ns) {
        Namespace = ns;
    }
}
