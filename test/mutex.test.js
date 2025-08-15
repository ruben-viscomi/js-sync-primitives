import { expect, test } from "vitest";
import { Mutex } from "../dist";

function readOperation(mutexGuard) {
    return mutexGuard.value;
}

function writeOperation(mutexGuard) {
    mutexGuard.value = (Math.random() * 100) % 100;
}

async function performLocking(mutex, operation) {
    const mutexGuard = await mutex.lock();
    const result = operation(mutexGuard);
    mutexGuard.release();
    return result
}

test("[lock API] - Test that mutex does not deadlock", async () => {
    const mutex = new Mutex(-1);
    const _writeOperation = () => performLocking(mutex, writeOperation);
    const _readOperation = () => performLocking(mutex, readOperation);

    const promises = [];
    for (let i = 0; i < 100000; i++) {
        promises.push(_writeOperation());
        promises.push(_readOperation());
    }

    await Promise.all(promises);
    const result = await _readOperation()
    expect(result).toBeGreaterThan(-1);
})

test("[lock API] - Test that mutex properly mutates", async () => {
    const mutex = new Mutex(-1);

    const mutationTest = async (mutex) => {
        const writeGuard = await mutex.lock();
        const before = writeGuard.value;
        const after = before + 1;
        writeGuard.value = after;
        writeGuard.release();
        const readGuard = await mutex.lock();
        expect(readGuard.value).toBeGreaterThan(before);
        expect(readGuard.value).toBe(after);
        readGuard.release();
        
    }

    for (let i = 0; i < 10000; i++)
        await mutationTest(mutex);
})

test("[runLocking API] - Test that mutex does not deadlock", async () => {
    const mutex = new Mutex(-1);
    const _writeOperation = () => mutex.runLocking(writeOperation);
    const _readOperation = () =>  mutex.runLocking(readOperation);

    const promises = [];
    for (let i = 0; i < 100000; i++) {
        promises.push(_writeOperation());
        promises.push(_readOperation());
    }

    await Promise.all(promises);
    const result = await _readOperation()
    expect(result).toBeGreaterThan(-1);
})

test("[runLocking API] - Test that mutex properly mutates", async () => {
    const mutex = new Mutex(-1);

    const mutationTest = async (mutex) => {

        
        const readGuard = await mutex.lock();
        expect(readGuard.value).toBeGreaterThan(before);
        expect(readGuard.value).toBe(after);
        readGuard.release();
        
    }

    for (let i = 0; i < 10000; i++) {
        const [before, after] = await mutex.runLocking((writeGuard) => {
            const before = writeGuard.value;
            const after = before + 1;
            writeGuard.value = after;
            return [before, after]
        });
        const actual = await mutex.runLocking((readGuard) => {
            return readGuard.value;
        });
        expect(actual).toBeGreaterThan(before);
        expect(actual).toBe(after);
    }
})