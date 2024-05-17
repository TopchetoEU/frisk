import { Token } from "./Token.ts";

export class Consumer {
    public get(i: number): Token | undefined { return this.tokens[i]; }
    public constructor(public readonly tokens: Token[]) { }
}