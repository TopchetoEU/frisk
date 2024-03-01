using System.Text;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Tree; 
public interface IExpression {
    Location Location { get; }
    public string ToString(int indent = 0) => ((object)this).ToString()!;
}
