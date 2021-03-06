// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

export function inaccessibleTypeToStr (obj) {
    return obj === null ? 'null' : 'undefined';
}

export function isNullOrUndefined (obj) {
    return !obj && (obj === null || typeof obj === 'undefined');
}

export function isObject (obj) {
    return typeof obj === 'object';
}

export function isString (obj) {
    return typeof obj === 'string';
}

export function isUndefined (obj) {
    return typeof obj === 'undefined';
}

export function isFunction (obj) {
    return typeof obj === 'function';
}
