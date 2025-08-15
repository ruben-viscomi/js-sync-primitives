export declare class Mutex<T> {
    private queued;
    private value;
    private locked;
    constructor(value: T);
    lock(): Promise<MutexGuard<T>>;
    runLocking<R>(callback: (value: MutexGuard<T>) => R): Promise<R>;
    private instantiateMutexGuard;
    private commit;
    private setValue;
    private release;
}
export declare class MutexGuard<T> {
    private commit;
    value: T;
    private released;
    constructor(value: T, commit: (value: T) => void);
    release(): void;
}
