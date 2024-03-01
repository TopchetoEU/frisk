using System.Collections.Immutable;
using System.Text;

namespace TopchetoEU.PpcLang.Utils;

public class ErrorMessage {
    public string Content { get; }
    public Location Location { get; }
    public IList<ErrorMessage> SubErrors { get; }

    public ErrorMessage Inherit(ErrorMessage? child) {
        return new(Content, Location, SubErrors.Concat(new[] { child }));
    }
    public ErrorMessage Inherit(IEnumerable<ErrorMessage?> children) {
        return new(Content, Location, SubErrors.Concat(children));
    }

    public string ToString(bool includeLoc = false, int indent = 0) {
        var res = new StringBuilder();
        res.Append('\t', indent);

        if (includeLoc) res.Append(Location).Append(": ");
        res.Append(Content);
        if (SubErrors.Count == 0) res.Append('.');
        else {
            res.Append(":\n");
            foreach (var err in SubErrors) {
                res.Append(err.ToString(true, indent + 1)).Append('\n');
            }
        }
        return res.ToString();
    }
    public override string ToString() => ToString(false, 0);

    public ErrorMessage(string content, Location loc) {
        this.Content = content;
        this.Location = loc;
        this.SubErrors = ImmutableList.Create<ErrorMessage>();
    }
    public ErrorMessage(string content, Location loc, ErrorMessage? child) {
        if (child != null) this.SubErrors = ImmutableList.Create(child);
        else this.SubErrors = ImmutableList.Create<ErrorMessage>();
        this.Content = content;
        this.Location = loc;
    }
    public ErrorMessage(string content, Location loc, IEnumerable<ErrorMessage?> children) {
        this.SubErrors = ImmutableList.Create(children.Where(v => v != null).ToArray())!;
        this.Content = content;
        this.Location = loc;
    }

    public static implicit operator Message(ErrorMessage msg) => new(MessageLevel.Error, msg.ToString(), msg.Location);
}