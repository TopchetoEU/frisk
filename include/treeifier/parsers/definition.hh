#pragma once

#include "lang/common.hh"
#include "treeifier/tokenizer.hh"
#include "treeifier/constr.hh"
#include "treeifier/constructs/glob.hh"
#include "treeifier/parsers/inspoint.hh"

namespace ppc::tree::parse {
    class definition_parser_t {
    public:
        virtual bool operator()(parse_ctx_t &ctx, size_t &res_i, std::unique_ptr<constr::definition_t> &res) const = 0;
        virtual ~definition_parser_t() = default;
    };
    template <class T>
    class def_parser_helper_t : public definition_parser_t {
    public:
        virtual bool operator()(parse_ctx_t &ctx, size_t &res_i, T &res) const = 0;
        bool operator()(parse_ctx_t &ctx, size_t &res_i, std::unique_ptr<constr::definition_t> &res) const {
            T _res;
            if ((*this)(ctx, res_i, _res)) {
                res = std::make_unique<constr::definition_t>(_res);
                return true;
            }
            return false;
        }
    };
}