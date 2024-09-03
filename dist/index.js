"use strict";
/**
 * SPDX-FileCopyrightText: 2024 Jan Chren ~rindeal
 *
 * SPDX-License-Identifier: GPL-3.0-only OR GPL-2.0-only
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.GitRepo = exports.RefDiff = exports.RefDiffTypes = void 0;
const child_process_1 = require("child_process");
const logger_1 = require("./logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
class RefDiffTypes extends String {
    static refCountMismatch = new RefDiffTypes('REF_COUNT_MISMATCH');
    static refNotFound = new RefDiffTypes('REF_NOT_FOUND');
    static hashMismatch = new RefDiffTypes('HASH_MISMATCH');
    static criticalError = new RefDiffTypes('CRITICAL_ERROR');
}
exports.RefDiffTypes = RefDiffTypes;
class RefDiff {
    message = '';
    type = '';
    sourceRefs = [];
    targetRefs = [];
    sourceRef = null;
    targetRef = null;
}
exports.RefDiff = RefDiff;
class GitRepo {
    repoUrl;
    _refs = null;
    refNameIndex = null;
    refHashIndex = null;
    constructor(repoUrl) {
        this.repoUrl = repoUrl;
        logger_1.Logger.info(`GitRepo instance created for \`${repoUrl}\``);
    }
    async getRefs() {
        if (this._refs) {
            logger_1.Logger.debug(`Returning cached refs for \`${this.repoUrl}\``);
            return this._refs;
        }
        else {
            logger_1.Logger.debug(`Fetching refs for \`${this.repoUrl}\``);
            return await this.fetchRefs();
        }
    }
    async fetchRefs() {
        logger_1.Logger.trace(`fetchRefs() called for \`${this.repoUrl}\``);
        const result = await new Promise((resolve, reject) => {
            if (!this.repoUrl.startsWith("https://")) {
                const errorMsg = `URL doesn't start with https://: \`${this.repoUrl}\``;
                logger_1.Logger.error(errorMsg);
                throw new Error(errorMsg);
            }
            (0, child_process_1.execFile)('git', ['ls-remote', this.repoUrl], {}, (error, stdout /*, stderr*/) => {
                if (error) {
                    logger_1.Logger.error(`Error fetching refs for \`${this.repoUrl}\`: \`${error.message}\``);
                    reject(error);
                }
                else {
                    logger_1.Logger.info(`Successfully fetched refs for \`${this.repoUrl}\``);
                    resolve(stdout);
                }
            });
        });
        const refs = result.split('\n')
            .filter(line => line)
            .map(line => {
            const [hash, name] = line.split('\t');
            logger_1.Logger.silly(`Parsed ref: \`${name}\` with hash: \`${hash}\``);
            return { name, hash };
        });
        this._refs = refs;
        logger_1.Logger.debug(`Fetched \`${refs.length}\` refs for \`${this.repoUrl}\``);
        return refs;
    }
    async _buildRefIndexes() {
        logger_1.Logger.trace(`_buildRefIndexes() called for \`${this.repoUrl}\``);
        if (!this._refs) {
            logger_1.Logger.debug(`No cached refs found, fetching refs for \`${this.repoUrl}\``);
            await this.fetchRefs();
        }
        this.refNameIndex = new Map();
        this.refHashIndex = new Map();
        for (const ref of this._refs) {
            this.refNameIndex.set(ref.name, ref);
            this.refHashIndex.set(ref.hash, ref);
            logger_1.Logger.silly(`Indexed ref: \`${ref.name}\` with hash: \`${ref.hash}\``);
        }
        logger_1.Logger.info(`Built ref indexes for \`${this.repoUrl}\``);
    }
    async getRefByName(name) {
        logger_1.Logger.trace(`getRefByName() called with name: \`${name}\``);
        if (!this.refNameIndex) {
            logger_1.Logger.debug(`Ref name index not built, building now for \`${this.repoUrl}\``);
            await this._buildRefIndexes();
        }
        const ref = this.refNameIndex.get(name);
        if (ref) {
            logger_1.Logger.info(`Found ref by name: \`${name}\``);
        }
        else {
            logger_1.Logger.warn(`Ref not found by name: \`${name}\``);
        }
        return ref;
    }
    async getRefByHash(hash) {
        logger_1.Logger.trace(`getRefByHash() called with hash: \`${hash}\``);
        if (!this.refHashIndex) {
            logger_1.Logger.debug(`Ref hash index not built, building now for \`${this.repoUrl}\``);
            await this._buildRefIndexes();
        }
        const ref = this.refHashIndex.get(hash);
        if (ref) {
            logger_1.Logger.info(`Found ref by hash: \`${hash}\``);
        }
        else {
            logger_1.Logger.warn(`Ref not found by hash: \`${hash}\``);
        }
        return ref;
    }
    async refsDiffer(targetRepo) {
        logger_1.Logger.trace(`refsDiffer() called between \`${this.repoUrl}\` and \`${targetRepo.repoUrl}\``);
        const [sourceRefs, targetRefs] = await Promise.all([
            this.getRefs(),
            targetRepo.getRefs(),
        ]);
        const refDiff = new RefDiff();
        refDiff.sourceRefs = sourceRefs;
        refDiff.targetRefs = targetRefs;
        if (sourceRefs.length === 0 || targetRefs.length === 0) {
            refDiff.message = `Critical error: One or both repositories have zero refs.`;
            refDiff.type = RefDiffTypes.criticalError;
            logger_1.Logger.fatal(refDiff.message);
            return refDiff;
        }
        if (sourceRefs.length !== targetRefs.length) {
            refDiff.message = `Ref count mismatch: source repo has \`${sourceRefs.length}\` refs, target repo has \`${targetRefs.length}\` refs.`;
            refDiff.type = RefDiffTypes.refCountMismatch;
            logger_1.Logger.warn(refDiff.message);
            return refDiff;
        }
        for (const sourceRef of sourceRefs) {
            const targetRef = await targetRepo.getRefByName(sourceRef.name);
            if (!targetRef) {
                refDiff.message = `Ref not found: \`${sourceRef.name}\` is missing in the target repo.`;
                refDiff.type = RefDiffTypes.refNotFound;
                refDiff.sourceRef = sourceRef;
                logger_1.Logger.error(refDiff.message);
                return refDiff;
            }
            if (sourceRef.hash !== targetRef.hash) {
                refDiff.message = `Hash mismatch for ref \`${sourceRef.name}\`: source repo has \`${sourceRef.hash}\`, target repo has \`${targetRef.hash}\`.`;
                refDiff.type = RefDiffTypes.hashMismatch;
                refDiff.sourceRef = sourceRef;
                refDiff.targetRef = targetRef;
                logger_1.Logger.error(refDiff.message);
                return refDiff;
            }
        }
        logger_1.Logger.info(`No differences found between \`${this.repoUrl}\` and \`${targetRepo.repoUrl}\``);
        return null;
    }
}
exports.GitRepo = GitRepo;
if (require.main === module) {
    (async () => {
        logger_1.Logger.logLevel = 'silly';
        const sourceRepo = new GitRepo('https://git.launchpad.net/beautifulsoup');
        const targetRepo = new GitRepo('https://github.com/facsimiles/beautifulsoup.git');
        // inject count mismatch fault
        const sourceRefs = await sourceRepo.getRefs();
        logger_1.Logger.debug(`Injected fault by removing ref: \`${sourceRefs.pop()?.name}\``);
        const diffResult = await sourceRepo.refsDiffer(targetRepo);
        if (diffResult) {
            logger_1.Logger.info('The repositories differ:');
            logger_1.Logger.info(diffResult);
            logger_1.Logger.info(diffResult.type.toString());
        }
        else {
            logger_1.Logger.info('The repositories are exact clones.');
        }
    })();
}
//# sourceMappingURL=index.js.map