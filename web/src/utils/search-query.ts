type QueryAccept = (cond: string) => boolean;
type QueryFilter<T> = (cond: string, from: T[]) => T[] | undefined;

interface QueryToken<T> {
    accept: QueryAccept;
    filter: QueryFilter<T>;
}

function tryResolve<T>(acceptableTokens: QueryToken<T>[], cond: string, from: T[]): T[] {
    for (const token of acceptableTokens) {
        if (token.accept(cond)) {
            return token.filter(cond, from) ?? [];
        }
    }
    return [];
}
