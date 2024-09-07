"use strict";
/**
 * SPDX-FileCopyrightText: 2024 Jan Chren ~rindeal
 *
 * SPDX-License: GPL-3.0-only OR GPL-2.0-only
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitRefDiffType = void 0;
var GitRefDiffType;
(function (GitRefDiffType) {
    GitRefDiffType["UNKNOWN"] = "UNKNOWN";
    GitRefDiffType["ZERO_REFS"] = "ZERO_REFS";
    GitRefDiffType["REF_COUNT_MISMATCH"] = "REF_COUNT_MISMATCH";
    GitRefDiffType["REF_NOT_FOUND"] = "REF_NOT_FOUND";
    GitRefDiffType["OID_MISMATCH"] = "OID_MISMATCH";
})(GitRefDiffType || (exports.GitRefDiffType = GitRefDiffType = {}));
//# sourceMappingURL=GitRefDiffType.js.map