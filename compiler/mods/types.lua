local utils = require "compiler.mods.utils";

local mod = utils.mkmod "builtin/types";

utils.deftype(mod, "i8", { kind = "int", size = 8, signed = true });
utils.deftype(mod, "i16", { kind = "int", size = 16, signed = true });
utils.deftype(mod, "i32", { kind = "int", size = 32, signed = true });
utils.deftype(mod, "i64", { kind = "int", size = 64, signed = true });

utils.deftype(mod, "u8", { kind = "int", size = 8, signed = false });
utils.deftype(mod, "u16", { kind = "int", size = 16, signed = false });
utils.deftype(mod, "u32", { kind = "int", size = 32, signed = false });
utils.deftype(mod, "u64", { kind = "int", size = 64, signed = false });

utils.deftype(mod, "f32", { kind = "float", size = 32, signed = false });
utils.deftype(mod, "f64", { kind = "float", size = 64, signed = false });
utils.deftype(mod, "f80", { kind = "float", size = 80, signed = false });

utils.deftype(mod, "bool", { kind = "bool" });
utils.deftype(mod, "opt", { kind = "generic", what = "opt" });

return mod;
