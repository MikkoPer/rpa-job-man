export const serializeCircular = (error) => {
    const seen = new WeakSet();
    return JSON.stringify(error, (key, value) => {
        if (value !== null && typeof value === 'object') {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    });
};
//# sourceMappingURL=utils.js.map