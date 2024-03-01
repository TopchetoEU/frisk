using System.Text;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Tree; 

public record TypeName(Namespace Name, int PointerCount, Location Location) {
    public override string ToString() {
        return new StringBuilder()
            .Append(Name.ToString())
            .Append('*', PointerCount)
            .Append('@')
            .Append(Location.ToString())
            .ToString();
    }
}
