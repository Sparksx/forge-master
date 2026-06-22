import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../events.js';

describe('EventEmitter', () => {
    it('calls listener when event is emitted', () => {
        const emitter = new EventEmitter();
        const cb = vi.fn();
        emitter.on('test', cb);
        emitter.emit('test', 'data');
        expect(cb).toHaveBeenCalledOnce();
        expect(cb).toHaveBeenCalledWith('data');
    });

    it('supports multiple listeners', () => {
        const emitter = new EventEmitter();
        const a = vi.fn();
        const b = vi.fn();
        emitter.on('e', a);
        emitter.on('e', b);
        emitter.emit('e', 42);
        expect(a).toHaveBeenCalledWith(42);
        expect(b).toHaveBeenCalledWith(42);
    });

    it('removes a listener with off()', () => {
        const emitter = new EventEmitter();
        const a = vi.fn();
        emitter.on('e', a);
        emitter.off('e', a);
        emitter.emit('e');
        expect(a).not.toHaveBeenCalled();
    });

    it('isolates a throwing listener from others', () => {
        const emitter = new EventEmitter();
        const bad = () => { throw new Error('boom'); };
        const good = vi.fn();
        emitter.on('e', bad);
        emitter.on('e', good);
        expect(() => emitter.emit('e')).not.toThrow();
        expect(good).toHaveBeenCalled();
    });
});
