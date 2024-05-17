import { Location } from "./Location.ts";

export class Message extends Error {
    public readonly children: Message[] = [];

    public constructor(
        public readonly content?: string,
        public readonly location = Location.None
    ) { super(""); }

    public push(...messages: Message[]) {
        for (const msg of messages) {
            if (msg.content === undefined) this.push(...msg.children);
            else this.children.push(msg);
        }
        return this;
    }

    public print(indentation = 0): void {
        let children = this.children.filter(v => v.content != null);

        if (this.content !== undefined) {
            const res: string[] = [];
            const loc = this.location.toString();

            for (let i = 0; i < indentation; i++) res.push("    ");
            res.push("error: ");

            if (loc.length != 0) res.push(loc + ": ");
            res.push(this.content);

            while (true) {
                if (children.length === 1) {
                    const child = children[0];

                    if (
                        child.location == Location.None || this.location == Location.None ||
                        child.location.toString() === this.location.toString()
                    ) {
                        res.push(': ', child.content!);
                        children = child.children.filter(v => v.content != null);
                        continue;
                    }
                }

                break;
            }

            Deno.stderr.writeSync(new TextEncoder().encode(res.join('') + '\n'));
            indentation++;
        }

        for (const el of children)el.print(indentation);
    }
}
