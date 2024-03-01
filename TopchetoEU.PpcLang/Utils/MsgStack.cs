using System.Collections;
using System.Diagnostics;

namespace TopchetoEU.PpcLang.Utils;

public class MsgStack: IEnumerable<Message> {
    private readonly List<Message> messages = new();

    public bool IsFailed {
        get {
            foreach (var msg in messages) {
                if (msg.IsSevere) return true;
            }
            return false;
        }
    }

    public void Error(string msg, Location? loc = null) => Push(new Message(MessageLevel.Error, msg, loc));
    public void Warn(string msg, Location? loc = null) => Push(new Message(MessageLevel.Warning, msg, loc));
    public void Suggest(string msg, Location? loc = null) => Push(new Message(MessageLevel.Suggestion, msg, loc));
    public void Info(string msg, Location? loc = null) => Push(new Message(MessageLevel.Info, msg, loc));
    public void Debug(string msg, Location? loc = null) => Push(new Message(MessageLevel.Debug, msg, loc));
    public void Push(Message msg) => messages.Add(msg);
    public void Push(MsgStack other) {
        foreach (var msg in other) Push(msg);
    }
    public void Clear() { messages.Clear(); }

    public void Print(TextWriter output, MessageLevel threshold = MessageLevel.Debug, bool color_output = false) {
        if (messages.Count == 0)
            return;

        foreach (var msg in messages) {
            if (msg.Level < threshold)
                continue;

            var loc_readable = msg.Location.ToString();

            switch (msg.Level) {
                case MessageLevel.Debug:
                    output.Write(color_output ? "\x1B[38;5;8mdebug: " : "debug: ");
                    break;
                case MessageLevel.Suggestion:
                    output.Write(color_output ? "\x1B[38;5;45msuggestion: " : "suggestion: ");
                    break;
                case MessageLevel.Info:
                    output.Write(color_output ? "\x1B[38;5;33minfo: " : "info: ");
                    break;
                case MessageLevel.Warning:
                    output.Write(color_output ? "\x1B[38;5;214mwarning: " : "warning: ");
                    break;
                case MessageLevel.Error:
                    output.Write(color_output ? "\x1B[38;5;196merror: " : "error: ");
                    break;
                default:
                    output.Write(color_output ? "\x1B[38;5;196mw\x1B[38;5;226mh\x1B[38;5;118ma\x1B[38;5;162mt\x1B[38;5;129m?\x1B[0m: " : "what?: ");
                    break;
            }

            if (loc_readable.Length != 0) output.Write(loc_readable + ": ");
            output.Write(msg.Content);
            if (color_output) output.Write("\x1B[0m");
            output.WriteLine();
        }
    }

    public IEnumerator<Message> GetEnumerator() => messages.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
