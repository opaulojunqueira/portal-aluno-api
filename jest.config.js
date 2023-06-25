"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseDir = "<rootDir>/src";
const baseTestDir = "<rootDir>/tests";
const config = {
    verbose: true,
    preset: "ts-jest",
    testEnvironment: "node",
    collectCoverage: true,
    collectCoverageFrom: [`${baseDir}/**/*.ts`],
    testMatch: [`${baseTestDir}/**/*.ts`],
};
exports.default = config;
