/** DVS 补丁只描述业务值；本模块不读取数据库或推断作者字段。 */
export type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
export type PatchKeys = Record<string, string | number>;
export interface PatchAnalysis {
    reason: string;
    table: string;
    keys: PatchKeys;
    field?: string;
}
export type PatchOperation = {
    reason: string;
    op: 'delta';
    table: string;
    keys: PatchKeys;
    field: string;
    value: number;
} | {
    reason: string;
    op: 'replace';
    table: string;
    keys: PatchKeys;
    field: string;
    value: JsonValue;
} | {
    reason: string;
    op: 'add';
    table: string;
    keys: PatchKeys;
    value: {
        [key: string]: JsonValue;
    };
} | {
    reason: string;
    op: 'remove';
    table: string;
    keys: PatchKeys;
};
export interface VariablePatch {
    Analysis: PatchAnalysis[];
    UpdateCommands: PatchOperation[];
}
export declare const PATCH_SCHEMA: {
    type: string;
    properties: {
        cot: {
            type: string;
        };
        Analysis: {
            type: string;
            items: {
                type: string;
                properties: {
                    reason: {
                        type: string;
                    };
                    table: {
                        type: string;
                        minLength: number;
                    };
                    keys: {
                        type: string;
                        propertyNames: {
                            minLength: number;
                        };
                        additionalProperties: {
                            anyOf: {
                                type: string;
                            }[];
                        };
                    };
                    field: {
                        type: string;
                        minLength: number;
                    };
                };
                required: string[];
                additionalProperties: boolean;
            };
        };
        UpdateCommands: {
            type: string;
            items: {
                anyOf: {
                    type: string;
                    properties: {
                        reason: {
                            type: string;
                        };
                        table: {
                            type: string;
                            minLength: number;
                        };
                        keys: {
                            type: string;
                            propertyNames: {
                                minLength: number;
                            };
                            additionalProperties: {
                                anyOf: {
                                    type: string;
                                }[];
                            };
                        };
                        op: {
                            type: string;
                            enum: string[];
                        };
                        field?: {
                            type: string;
                            minLength: number;
                        } | undefined;
                        value?: Record<string, unknown> | undefined;
                    };
                    required: string[];
                    additionalProperties: boolean;
                }[];
            };
        };
    };
    required: string[];
    additionalProperties: boolean;
};
export declare function validatePatch(value: unknown): VariablePatch;
/** text 只解开包裹，不修复 JSON；字符串、数组内的对象不作候选。 */
export declare function parsePatchData(content: string, format?: 'text' | 'json_object' | 'json_schema'): unknown;
export declare function parsePatch(content: string, format?: 'text' | 'json_object' | 'json_schema'): VariablePatch;
