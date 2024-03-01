namespace TopchetoEU.PpcLang.Utils;

public class MessageException: Exception {
    public Message Msg { get; }

    public MessageException(Message message): base(message.ToString()) {
        Msg = message;
    }
    public MessageException(MessageLevel level, string content, Location? loc = null) : this(new(level, content, loc)) { }
}
