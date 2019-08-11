export type LogLevel = 'info' | 'important' | 'warn';

export type Logger = {
    [k in LogLevel]: (message: string) => void;
};

export function logger() {
    return loggerImpl({
        warn: true,
        important: true,
    });
}

export function logDebug(obj: any) {
    // tslint:disable-next-line: no-console
    console.log(obj);
}

export function logTime<T = void>(msg: string, f: () => T): T {
    const begin = Date.now();
    logger().info(`${msg} - start`);
    const result = f();
    const end = Date.now();
    const diff = end - begin;
    logger().info(`${msg} duration: ${diff / 1000}s`);
    return result;
}

export async function logTimeAsync<T = void>(msg: string, f: () => Promise<T>): Promise<T> {
    const begin = Date.now();
    logger().info(`${msg} -- start`);
    const result = await f();
    const end = Date.now();
    const diff = end - begin;
    logger().info(`${msg} -- end: ${diff / 1000}s`);
    return result;
}

type LoggerSettings = {
    [k in LogLevel]?: boolean;
};
function loggerImpl(settings: LoggerSettings): Logger {
    return {
        info(message: string) {
            if (settings.info) {
                // tslint:disable-next-line: no-console
                console.log(message);
            }
        },

        warn(message: string) {
            if (settings.warn) {
                // tslint:disable-next-line: no-console
                console.log(message);
            }
        },

        important(message: string) {
            if (settings.important) {
                // tslint:disable-next-line: no-console
                console.log(message);
            }
        },
    };
}
