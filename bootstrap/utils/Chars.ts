export namespace Chars {
    export function digit(c: string) { return c >= '0' && c <= '9'; }
    export function octal(c: string) { return c >= '0' && c <= '7'; }
    export function hex(c: string) { return digit(c) || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f'); }

    export function lower(c: string) { return c >= 'a' && c <= 'z'; }
    export function upper(c: string) { return c >= 'A' && c <= 'Z'; }
    export function alphanumeric(c: string) { return lower(c) || upper(c) || digit(c); }

    export function anyOf(c: string, chars: string) {  return chars.includes(c); }
}
