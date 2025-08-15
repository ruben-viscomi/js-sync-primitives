// ==============================================================================
// MIT License
//
// Copyright (c) 2025 Ruben Viscomi
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// ==============================================================================
export class Mutex<T> {
    private queued: Queue<() => void>;
    private value: T;
    private locked: boolean;
    
    constructor(value: T) {
        this.value = value;
        this.queued = new Queue();
        this.locked = false;
    }

    async lock(): Promise<MutexGuard<T>> {
        if (!this.locked && this.queued.isEmpty()) {
            // If the only accessor, do a quick lock.
            this.locked = true;
            return this.instantiateMutexGuard();
        }
        const deferred = new Deferred<void>();
        const startLock = deferred.resolve;
        const waitLock = deferred.promise;
        this.queued.enqueue(startLock);
        await waitLock;
        this.locked = true;
        return this.instantiateMutexGuard();
    }

    async runLocking<R>(callback: (value: MutexGuard<T>) => R): Promise<R> {
        const mutexGuard = await this.lock();
        const result = callback(mutexGuard);
        mutexGuard.release();
        return result;
    }

    private instantiateMutexGuard(): MutexGuard<T> {
        return new MutexGuard(this.value, (value: T) => this.commit(value));
    }

    private commit(value: T) {
        this.setValue(value);
        this.release();
    }

    private setValue(value: T) {
        // TODO - avoid allocations.
        this.value = clone(value);
    }

    private release() {
        const next = this.queued.dequeue();
        this.locked = false;
        if (next)
            next();
    }
}

export class MutexGuard<T> {
    public value: T;
    private released: boolean;

    constructor(
        value: T,
        private commit: (value: T) => void,
    ) {
        // We clone to prevent setting properties of value in the mutex.
        // Especially useful when lock has been released.
        this.value = clone(value);
        this.released = false;
    }

    release() {
        if (this.released)
            return;
        this.released = true;
        this.commit(this.value);
    }
}

class ImmutableQueueNode<T> {
    private _value: T;

    constructor(
        value: T,
        public next: ImmutableQueueNode<T> | null = null,
    ) {
        this._value = typeof value === "object"
            ? Object.freeze(value)
            : value;
    }

    get value(): T {
        return this._value;
    }
}

class Queue<T> {
    private head: ImmutableQueueNode<T> | null;
    private last: ImmutableQueueNode<T> | null;
    private _length: number

    constructor(...values: T[]) {
        this.head = null;
        this.last = null;
        this._length = 0;
        this.enqueueAll(values);
    }

    get length() { return this._length }
    isEmpty(): boolean { return !this.length }

    dequeue(): T | null {
        if (this._length > 0)
            this._length -= 1;
        if (!this.head)
            return null;
        const value = this.head.value;
        this.head = this.head.next;
        if (!this.head)
            this.last = null;
        return value;
    }

    enqueue(value: T) {
        this._length += 1;
        const node = new ImmutableQueueNode(value);
        if (this.last) {
            this.last.next = node;
            this.last = this.last.next;
            return
        }
        this.head = node;
        this.last = this.head;
    }

    private enqueueAll(values: T[]) {
        for (const value of values) {
            this.enqueue(value);
        }
    }
}

class Deferred<T> {
    private _resolve: (value: T) => void;
    private _reject: (reason?: any) => void;
    private _promise: Promise<T>;

    constructor() {
        this._resolve = () => {};
        this._reject = () => {};
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    get resolve() { return this._resolve }
    get reject() { return this._reject }
    get promise() { return this._promise }
}

function clone<T>(data: T): T {
    if (typeof data !== "object" || data == null)
        return data;
    if (Array.isArray(data))
        return data.map(clone) as T;

    const object: Record<string | number | symbol, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
        object[k] = clone(v);
    }
    return object as T;
}