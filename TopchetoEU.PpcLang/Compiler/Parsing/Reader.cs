using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing;

public delegate ReadResult<T> Reader<T>(ReadContext ctx);
public delegate ReadResult<T> ArgumentReader<T, in T1>(ReadContext ctx, T1 arg);
