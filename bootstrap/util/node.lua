local node = {};

--- @class node.loc
--- @field filename string
--- @field row integer
--- @field col integer

--- @class node.base
--- @field loc node.loc


--- @class node.parameter
--- @field type node.exp
--- @field kind? "ref" | "own"
--- @field generic? boolean
--- @field name? string

--- @class node.signature
--- @field kind "signature"
--- @field params node.parameter[]
--- @field spread? node.parameter
--- @field ret node.exp

--- @class node.func: node.base
--- @field kind "func"
--- @field sig node.signature
--- @field body node.stm


--- @class node.var: node.base
--- @field kind "var"
--- @field name string

--- @class node.str: node.base
--- @field kind "lit_str"
--- @field val string

--- @class node.int: node.base
--- @field kind "lit_int"
--- @field char boolean
--- @field val integer

--- @class node.fl: node.base
--- @field kind "lit_fl"
--- @field val number

--- @class node.tuple_member: node.base
--- @field kind? "tuple_member"
--- @field key node.exp | string
--- @field val node.exp

--- @class node.tuple_spread: node.base
--- @field kind? "tuple_spread"
--- @field val node.exp

--- @class node.tuple: node.base
--- @field kind "tuple"
--- @field members (node.exp | node.tuple_member | node.tuple_spread)[]

--- @class node.call: node.base
--- @field kind "call" | "index"
--- @field func node.exp
--- @field args node.tuple

--- @class node.member: node.base
--- @field kind "member"
--- @field obj node.exp
--- @field key string | node.exp

--- @class node.op: node.base
--- @field kind "op"
--- @field op integer
--- @field args node.exp[]

--- @class node.assign: node.base
--- @field kind "assign"
--- @field op? integer
--- @field target node.exp
--- @field val node.exp


--- @class node.struct_member: node.base
--- @field type node.exp
--- @field name? string

--- @class node.struct: node.base
--- @field kind "struct" | "union"
--- @field fields node.struct_member[]

--- @alias node.exp
--- | node.var
--- | node.str
--- | node.int
--- | node.fl
--- | node.tuple
--- | node.func
--- | node.call
--- | node.member
--- | node.op
--- | node.assign
--- | node.struct
--- | node.signature


--- @class node.block: node.base
--- @field kind "block"
--- @field body node.stm[]

--- @class node.cond
--- @field loc node.loc
--- @field kind "cond"
--- @field cond node.exp
--- @field if_body node.stm
--- @field else_body? node.stm

--- @class node.loop: node.base
--- @field kind "loop"
--- @field cond? node.exp
--- @field pre_body? node.stm
--- @field post_body? node.stm

--- @class node.for: node.base
--- @field kind "for"
--- @field init? node.stm | node.var
--- @field cond? node.exp
--- @field update? node.stm | node.exp
--- @field body node.stm

--- @class node.return: node.base
--- @field kind "return"
--- @field val? node.exp

--- @class node.break: node.base
--- @field kind "break"

--- @class node.continue: node.base
--- @field kind "continue"

--- @class node.decl_part
--- @field add boolean
--- @field name string[]
--- @field val? node.exp

--- @class node.decl: node.base
--- @field kind "decl"
--- @field mut boolean
--- @field weak boolean
--- @field attribs node.exp[]
--- @field type? node.exp
--- @field parts node.decl_part[]

--- @class node.export: node.base
--- @field kind "export"
--- @field dst? string
--- @field decl node.decl

--- @class node.export_alias: node.base
--- @field kind "export_alias"
--- @field dst? string
--- @field val node.exp

--- @alias node.stm
--- | node.exp
--- | node.block
--- | node.cond
--- | node.loop
--- | node.for
--- | node.return
--- | node.break
--- | node.continue
--- | node.decl
--- | node.export
--- | node.export_alias

node.ops = {
	NOT = 1,
	NEG = 2,
	POS = 3,
	B_NEG = 4,
	REF = 5,
	DEREF = 6,
	TRY = 7,
	ASSERT = 8,
	-- How else would you pronounce '@'
	SPELONDGE = 9,

	POW = 10,

	MUL = 11,
	DIV = 12,
	MOD = 13,

	ADD = 14,
	SUB = 15,
	CAT = 16,

	B_SHL = 21,
	B_SHR = 22,
	B_AND = 23,
	B_OR = 24,
	B_XOR = 25,

	EQ = 30,
	NEQ = 31,
	LE = 32,
	GR = 33,
	LEQ = 34,
	GREQ = 35,

	AND = 36,
	OR = 37,
};

function node.loc(filename, row, col)
	return { filename = filename, row = row, col = col } --[[@as node.loc]];
end

return node;
