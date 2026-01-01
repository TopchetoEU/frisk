local err = require "compiler.util.err";
local resolve_type = require "compiler.resolve.type";
local resolve_ast = require "compiler.resolve.ast";

--- @alias rsl.field_path integer[]

--- @param file walk.file
return function (file)
	for _, type in pairs(file.syms.types) do
		if not type.resolved then
			resolve_type.resolve(file, type.type, type);
		end
	end
	for _, syms in pairs(file.syms.syms) do
		resolve_ast.resolve_syms(file, syms);
	end
end
