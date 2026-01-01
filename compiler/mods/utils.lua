local symbols = require "compiler.util.symbols";
local node = require "compiler.util.node";
local utils = {};

--- @param mod walk.file
function utils.loc(mod)
	return node.loc(mod, 1, 1);
end

--- @param name string
function utils.mkmod(name)
	--- @type walk.file
	return {
		filename = "name",
		exports = symbols(),
		syms = symbols(),
		export_w = {},
		import_w = {},
	}
end

--- @param mod walk.file
--- @param name string
--- @param type rsl.type
function utils.deftype(mod, name, type)
	local loc = utils.loc(mod);
	mod.exports:add_type(name, {
		file = mod,
		loc = loc,
		name = name,
		type = node.type_id(loc, name),
		resolved = type
	});
end

return utils;
