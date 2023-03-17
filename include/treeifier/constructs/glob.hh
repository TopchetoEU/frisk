#pragma once

#include <vector>
#include <memory>
#include "lang/common.hh"
#include "utils/message.hh"

#ifdef PROFILE_debug
#include <iostream>
#endif

namespace ppc::tree::constr {
    using namespace ppc::lang;
    using namespace ppc::messages;

    struct global_t;

    struct definition_t {
        #ifdef PROFILE_debug
        virtual void print() const {
            std::cout << "(unknown)";
        }
        #endif
    };

    struct global_t {
        loc_nmsp_t nmsp;
        std::vector<std::unique_ptr<definition_t>> defs;
        std::vector<loc_nmsp_t> imports;

        #ifdef PROFILE_debug
        void print() const {
            std::cout << "Namespace: " << nmsp.to_string() << "\n";
            std::cout << "Imports:\n";
            for (auto &imp : imports) {
                std::cout << " - " << imp.to_string() << "\n";
            }
            std::cout << "Defs:\n\n";
            for (auto &def : defs) {
                def->print();
                std::cout << "\n";
            }
        }
        #endif
    };
}