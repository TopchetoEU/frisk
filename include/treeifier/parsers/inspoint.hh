#pragma once

#include "treeifier/constr.hh"
#include "treeifier/parsers/helper.hh"

#ifdef PROFILE_debug
#include <iostream>
#endif

namespace ppc::tree::parse {
    template <class ParserT, class ResT, class ...ArgsT>
    class inspoint_t {
    private:
        std::map<std::string, std::unique_ptr<const ParserT>> parsers;
    public:
        inspoint_t<ParserT, ResT> &add(const std::string &name, const std::unique_ptr<const ParserT> &parser, bool replace = false) {
            auto it = parsers.find(name);
            if (it != parsers.end()) {
                if (!replace) throw "The parser '" + name + "' is already in the group.";
                it->second = parser;
            }
            else {
                parsers.emplace(name, parser);
            }

            return *this;
        }

        bool operator()(ppc::tree::parse_ctx_t &ctx, size_t &i, ResT &out, ArgsT ...args) const {
            helper_t h(ctx, i);

            if (h.ended()) return false;

            for (const auto &pair : parsers) {
                if (h.parse(*pair.second, out, args...)) return true;
            }

            return false;
        }
    };
}