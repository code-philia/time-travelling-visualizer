import IO from 'socket.io-client';

const host = 'http://127.0.0.1:5000';
export const socket = IO(host);

export function fetch<T = any>(
    event: string,
    data: any = {},
): Promise<[string | null, T | null]> {
    return new Promise((resolve) => {
        socket.emit(event, data, (res: any) => {
            if (typeof res === 'string') {
                resolve([res, null]);
            } else {
                resolve([null, res]);
            }
        });
    });
}
