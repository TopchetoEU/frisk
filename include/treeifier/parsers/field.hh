#pragma once

#include "lang/common.hh"
#include "treeifier/tokenizer.hh"
#include "treeifier/constr.hh"
#include "treeifier/constructs/field.hh"
#include "treeifier/parsers/glob.hh"

namespace ppc::tree::parse {
    class field_parser_t : public def_parser_helper_t<constr::field_t> {
    public:
        bool operator()(parse_ctx_t &ctx, size_t &res_i, constr::field_t &out) const override;
    };
}