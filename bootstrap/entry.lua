require "bootstrap.util.printing";
local err = require "bootstrap.util.err";
local syntax  = require "bootstrap.parser";

local f = assert(io.open(..., "r"));

local ok, res, loc = err.catch(syntax, f:read "a", (...));

if not ok then
	assert(loc);
	print(loc.filename .. ":" .. loc.row .. ":" .. loc.col .. ": " .. res);
else
	pprint(res);
end
-- 	--- @cast res walk.file
-- 	for i = #res, 1, -1 do
-- 		local file = res[i];

-- 		local ok2, msg2, loc2 = err.catch(resolve, file);
-- 		if not ok2 then
-- 			assert(loc2);
-- 			print(loc2.filename .. ":" .. loc2.row .. ":" .. loc2.col .. ": " .. msg2);
-- 			return;
-- 		end

-- 		print(file.filename .. ":");

-- 		print("\tSymbols:");
-- 		for k in pairs(file.syms.syms) do
-- 			print("\t\t" .. k);
-- 		end
-- 		for k in pairs(file.syms.types) do
-- 			print("\t\ttype " .. k);
-- 		end

-- 		print("\tExports:");

-- 		for k in pairs(file.exports.syms) do
-- 			print("\t\t" .. k);
-- 		end
-- 		for k in pairs(file.exports.types) do
-- 			print("\t\ttype " .. k);
-- 		end
-- 	end
-- end
