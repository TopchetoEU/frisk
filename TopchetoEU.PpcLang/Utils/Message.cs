namespace TopchetoEU.PpcLang.Utils;

public readonly struct Message {
    public MessageLevel Level { get; }
    public string Content { get; }
    public Location Location { get; }
    public bool IsSevere => Level > MessageLevel.Warning;

    public override string ToString() {
        var loc_readable = Location.ToString();
        var level_readable = Level switch {
            MessageLevel.Debug => "debug",
            MessageLevel.Suggestion => "suggestion",
            MessageLevel.Info => "info",
            MessageLevel.Warning => "warning",
            MessageLevel.Error => "error",
            _ => "what?",
        };

        if (loc_readable != null)
            return loc_readable + ": " + level_readable + ": " + Content;
        else
            return level_readable + ": " + Content;
    }

    public Message(MessageLevel level, string content, Location? loc = null) {
        this.Level = level;
        this.Content = content;
        this.Location = loc ?? Location.None;
    }
    public Message() : this(MessageLevel.Debug, "") { }


    public static Message Error(string message, Location? loc = null) {
        return new(MessageLevel.Error, message, loc);
    }
}
