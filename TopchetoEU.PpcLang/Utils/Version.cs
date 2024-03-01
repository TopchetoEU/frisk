namespace TopchetoEU.PpcLang.Utils;

public readonly record struct Version(ushort Major = 0, ushort Minor = 0, uint Revision = 0)
{
    public bool IsCompliant(Version dependency, bool linking = false)
    {
        if (Major != dependency.Major && dependency.Major != 0) return false;
        if (linking)
        {
            if (Minor != dependency.Minor && dependency.Minor != 0) return false;
            if (Revision < dependency.Revision) return false;
            return true;
        }
        else
        {
            if (Minor < dependency.Minor) return false;
            return true;
        }
    }
}
