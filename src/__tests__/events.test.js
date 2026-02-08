import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../events.js';

describe('EventEmitter', () => {
    it('calls listener when event is emitted', () => {
        const emitter = new EventEmitter();
        const callback = vi.fn();

        emitter.on('test', callback);
        emitter.emit('test', 'data');

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith('data');
    });

    it('supports multiple listeners on same event', () => {
        const emitter = new EventEmitter();
        const cb1 = vi.fn();
        const cb2 = vi.fn();

        emitter.on('test', cb1);
        emitter.on('test', cb2);
        emitter.emit('test', 42);

        expect(cb1).toHaveBeenCalledWith(42);
        expect(cb2).toHaveBeenCalledWith(42);
    });

    it('does not call listeners for other events', () => {
        const emitter = new EventEmitter();
        const callback = vi.fn();

        emitter.on('test', callback);
        emitter.emit('other');

        expect(callback).not.toHaveBeenCalled();
    });

    it('removes specific listener with off()', () => {
        const emitter = new EventEmitter();
        const cb1 = vi.fn();
        const cb2 = vi.fn();

        emitter.on('test', cb1);
        emitter.on('test', cb2);
        emitter.off('test', cb1);
        emitter.emit('test');

        expect(cb1).not.toHaveBeenCalled();
        expect(cb2).toHaveBeenCalledOnce();
    });

    it('does nothing when emitting event with no listeners', () => {
        const emitter = new EventEmitter();
        expect(() => emitter.emit('nonexistent')).not.toThrow();
    });

    it('does nothing when off() on nonexistent event', () => {
        const emitter = new EventEmitter();
        expect(() => emitter.off('nonexistent', () => {})).not.toThrow();
    });

    it('passes undefined data when emitting without data', () => {
        const emitter = new EventEmitter();
        const callback = vi.fn();

        emitter.on('test', callback);
        emitter.emit('test');

        expect(callback).toHaveBeenCalledWith(undefined);
    });
});
