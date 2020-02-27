
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let stylesheet;
    let active = 0;
    let current_rules = {};
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        if (!current_rules[name]) {
            if (!stylesheet) {
                const style = element('style');
                document.head.appendChild(style);
                stylesheet = style.sheet;
            }
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        node.style.animation = (node.style.animation || '')
            .split(', ')
            .filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        )
            .join(', ');
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.18.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var parallax = createCommonjsModule(function (module, exports) {
    (function(f){{module.exports=f();}})(function(){return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof commonjsRequire=="function"&&commonjsRequire;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r);}return n[o].exports}var i=typeof commonjsRequire=="function"&&commonjsRequire;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
    /* eslint-disable no-unused-vars */
    var getOwnPropertySymbols = Object.getOwnPropertySymbols;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var propIsEnumerable = Object.prototype.propertyIsEnumerable;

    function toObject(val) {
    	if (val === null || val === undefined) {
    		throw new TypeError('Object.assign cannot be called with null or undefined');
    	}

    	return Object(val);
    }

    function shouldUseNative() {
    	try {
    		if (!Object.assign) {
    			return false;
    		}

    		// Detect buggy property enumeration order in older V8 versions.

    		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
    		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
    		test1[5] = 'de';
    		if (Object.getOwnPropertyNames(test1)[0] === '5') {
    			return false;
    		}

    		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
    		var test2 = {};
    		for (var i = 0; i < 10; i++) {
    			test2['_' + String.fromCharCode(i)] = i;
    		}
    		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
    			return test2[n];
    		});
    		if (order2.join('') !== '0123456789') {
    			return false;
    		}

    		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
    		var test3 = {};
    		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
    			test3[letter] = letter;
    		});
    		if (Object.keys(Object.assign({}, test3)).join('') !==
    				'abcdefghijklmnopqrst') {
    			return false;
    		}

    		return true;
    	} catch (err) {
    		// We don't expect any of the above to throw, but better to be safe.
    		return false;
    	}
    }

    module.exports = shouldUseNative() ? Object.assign : function (target, source) {
    	var from;
    	var to = toObject(target);
    	var symbols;

    	for (var s = 1; s < arguments.length; s++) {
    		from = Object(arguments[s]);

    		for (var key in from) {
    			if (hasOwnProperty.call(from, key)) {
    				to[key] = from[key];
    			}
    		}

    		if (getOwnPropertySymbols) {
    			symbols = getOwnPropertySymbols(from);
    			for (var i = 0; i < symbols.length; i++) {
    				if (propIsEnumerable.call(from, symbols[i])) {
    					to[symbols[i]] = from[symbols[i]];
    				}
    			}
    		}
    	}

    	return to;
    };

    },{}],2:[function(require,module,exports){
    (function (process){
    // Generated by CoffeeScript 1.12.2
    (function() {
      var getNanoSeconds, hrtime, loadTime, moduleLoadTime, nodeLoadTime, upTime;

      if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
        module.exports = function() {
          return performance.now();
        };
      } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
        module.exports = function() {
          return (getNanoSeconds() - nodeLoadTime) / 1e6;
        };
        hrtime = process.hrtime;
        getNanoSeconds = function() {
          var hr;
          hr = hrtime();
          return hr[0] * 1e9 + hr[1];
        };
        moduleLoadTime = getNanoSeconds();
        upTime = process.uptime() * 1e9;
        nodeLoadTime = moduleLoadTime - upTime;
      } else if (Date.now) {
        module.exports = function() {
          return Date.now() - loadTime;
        };
        loadTime = Date.now();
      } else {
        module.exports = function() {
          return new Date().getTime() - loadTime;
        };
        loadTime = new Date().getTime();
      }

    }).call(this);



    }).call(this,require('_process'));

    },{"_process":3}],3:[function(require,module,exports){
    // shim for using process in browser
    var process = module.exports = {};

    // cached from whatever global is present so that test runners that stub it
    // don't break things.  But we need to wrap it in a try catch in case it is
    // wrapped in strict mode code which doesn't define any globals.  It's inside a
    // function because try/catches deoptimize in certain engines.

    var cachedSetTimeout;
    var cachedClearTimeout;

    function defaultSetTimout() {
        throw new Error('setTimeout has not been defined');
    }
    function defaultClearTimeout () {
        throw new Error('clearTimeout has not been defined');
    }
    (function () {
        try {
            if (typeof setTimeout === 'function') {
                cachedSetTimeout = setTimeout;
            } else {
                cachedSetTimeout = defaultSetTimout;
            }
        } catch (e) {
            cachedSetTimeout = defaultSetTimout;
        }
        try {
            if (typeof clearTimeout === 'function') {
                cachedClearTimeout = clearTimeout;
            } else {
                cachedClearTimeout = defaultClearTimeout;
            }
        } catch (e) {
            cachedClearTimeout = defaultClearTimeout;
        }
    } ());
    function runTimeout(fun) {
        if (cachedSetTimeout === setTimeout) {
            //normal enviroments in sane situations
            return setTimeout(fun, 0);
        }
        // if setTimeout wasn't available but was latter defined
        if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
            cachedSetTimeout = setTimeout;
            return setTimeout(fun, 0);
        }
        try {
            // when when somebody has screwed with setTimeout but no I.E. maddness
            return cachedSetTimeout(fun, 0);
        } catch(e){
            try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                return cachedSetTimeout.call(null, fun, 0);
            } catch(e){
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                return cachedSetTimeout.call(this, fun, 0);
            }
        }


    }
    function runClearTimeout(marker) {
        if (cachedClearTimeout === clearTimeout) {
            //normal enviroments in sane situations
            return clearTimeout(marker);
        }
        // if clearTimeout wasn't available but was latter defined
        if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
            cachedClearTimeout = clearTimeout;
            return clearTimeout(marker);
        }
        try {
            // when when somebody has screwed with setTimeout but no I.E. maddness
            return cachedClearTimeout(marker);
        } catch (e){
            try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                return cachedClearTimeout.call(null, marker);
            } catch (e){
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                return cachedClearTimeout.call(this, marker);
            }
        }



    }
    var queue = [];
    var draining = false;
    var currentQueue;
    var queueIndex = -1;

    function cleanUpNextTick() {
        if (!draining || !currentQueue) {
            return;
        }
        draining = false;
        if (currentQueue.length) {
            queue = currentQueue.concat(queue);
        } else {
            queueIndex = -1;
        }
        if (queue.length) {
            drainQueue();
        }
    }

    function drainQueue() {
        if (draining) {
            return;
        }
        var timeout = runTimeout(cleanUpNextTick);
        draining = true;

        var len = queue.length;
        while(len) {
            currentQueue = queue;
            queue = [];
            while (++queueIndex < len) {
                if (currentQueue) {
                    currentQueue[queueIndex].run();
                }
            }
            queueIndex = -1;
            len = queue.length;
        }
        currentQueue = null;
        draining = false;
        runClearTimeout(timeout);
    }

    process.nextTick = function (fun) {
        var args = new Array(arguments.length - 1);
        if (arguments.length > 1) {
            for (var i = 1; i < arguments.length; i++) {
                args[i - 1] = arguments[i];
            }
        }
        queue.push(new Item(fun, args));
        if (queue.length === 1 && !draining) {
            runTimeout(drainQueue);
        }
    };

    // v8 likes predictible objects
    function Item(fun, array) {
        this.fun = fun;
        this.array = array;
    }
    Item.prototype.run = function () {
        this.fun.apply(null, this.array);
    };
    process.title = 'browser';
    process.browser = true;
    process.env = {};
    process.argv = [];
    process.version = ''; // empty string to avoid regexp issues
    process.versions = {};

    function noop() {}

    process.on = noop;
    process.addListener = noop;
    process.once = noop;
    process.off = noop;
    process.removeListener = noop;
    process.removeAllListeners = noop;
    process.emit = noop;
    process.prependListener = noop;
    process.prependOnceListener = noop;

    process.listeners = function (name) { return [] };

    process.binding = function (name) {
        throw new Error('process.binding is not supported');
    };

    process.cwd = function () { return '/' };
    process.chdir = function (dir) {
        throw new Error('process.chdir is not supported');
    };
    process.umask = function() { return 0; };

    },{}],4:[function(require,module,exports){
    (function (global){
    var now = require('performance-now')
      , root = typeof window === 'undefined' ? global : window
      , vendors = ['moz', 'webkit']
      , suffix = 'AnimationFrame'
      , raf = root['request' + suffix]
      , caf = root['cancel' + suffix] || root['cancelRequest' + suffix];

    for(var i = 0; !raf && i < vendors.length; i++) {
      raf = root[vendors[i] + 'Request' + suffix];
      caf = root[vendors[i] + 'Cancel' + suffix]
          || root[vendors[i] + 'CancelRequest' + suffix];
    }

    // Some versions of FF have rAF but not cAF
    if(!raf || !caf) {
      var last = 0
        , id = 0
        , queue = []
        , frameDuration = 1000 / 60;

      raf = function(callback) {
        if(queue.length === 0) {
          var _now = now()
            , next = Math.max(0, frameDuration - (_now - last));
          last = next + _now;
          setTimeout(function() {
            var cp = queue.slice(0);
            // Clear queue here to prevent
            // callbacks from appending listeners
            // to the current frame's queue
            queue.length = 0;
            for(var i = 0; i < cp.length; i++) {
              if(!cp[i].cancelled) {
                try{
                  cp[i].callback(last);
                } catch(e) {
                  setTimeout(function() { throw e }, 0);
                }
              }
            }
          }, Math.round(next));
        }
        queue.push({
          handle: ++id,
          callback: callback,
          cancelled: false
        });
        return id
      };

      caf = function(handle) {
        for(var i = 0; i < queue.length; i++) {
          if(queue[i].handle === handle) {
            queue[i].cancelled = true;
          }
        }
      };
    }

    module.exports = function(fn) {
      // Wrap in a new function to prevent
      // `cancel` potentially being assigned
      // to the native rAF function
      return raf.call(root, fn)
    };
    module.exports.cancel = function() {
      caf.apply(root, arguments);
    };
    module.exports.polyfill = function() {
      root.requestAnimationFrame = raf;
      root.cancelAnimationFrame = caf;
    };

    }).call(this,typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});

    },{"performance-now":2}],5:[function(require,module,exports){

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    /**
    * Parallax.js
    * @author Matthew Wagerfield - @wagerfield, René Roth - mail@reneroth.org
    * @description Creates a parallax effect between an array of layers,
    *              driving the motion from the gyroscope output of a smartdevice.
    *              If no gyroscope is available, the cursor position is used.
    */

    var rqAnFr = require('raf');
    var objectAssign = require('object-assign');

    var helpers = {
      propertyCache: {},
      vendors: [null, ['-webkit-', 'webkit'], ['-moz-', 'Moz'], ['-o-', 'O'], ['-ms-', 'ms']],

      clamp: function clamp(value, min, max) {
        return min < max ? value < min ? min : value > max ? max : value : value < max ? max : value > min ? min : value;
      },
      data: function data(element, name) {
        return helpers.deserialize(element.getAttribute('data-' + name));
      },
      deserialize: function deserialize(value) {
        if (value === 'true') {
          return true;
        } else if (value === 'false') {
          return false;
        } else if (value === 'null') {
          return null;
        } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
          return parseFloat(value);
        } else {
          return value;
        }
      },
      camelCase: function camelCase(value) {
        return value.replace(/-+(.)?/g, function (match, character) {
          return character ? character.toUpperCase() : '';
        });
      },
      accelerate: function accelerate(element) {
        helpers.css(element, 'transform', 'translate3d(0,0,0) rotate(0.0001deg)');
        helpers.css(element, 'transform-style', 'preserve-3d');
        helpers.css(element, 'backface-visibility', 'hidden');
      },
      transformSupport: function transformSupport(value) {
        var element = document.createElement('div'),
            propertySupport = false,
            propertyValue = null,
            featureSupport = false,
            cssProperty = null,
            jsProperty = null;
        for (var i = 0, l = helpers.vendors.length; i < l; i++) {
          if (helpers.vendors[i] !== null) {
            cssProperty = helpers.vendors[i][0] + 'transform';
            jsProperty = helpers.vendors[i][1] + 'Transform';
          } else {
            cssProperty = 'transform';
            jsProperty = 'transform';
          }
          if (element.style[jsProperty] !== undefined) {
            propertySupport = true;
            break;
          }
        }
        switch (value) {
          case '2D':
            featureSupport = propertySupport;
            break;
          case '3D':
            if (propertySupport) {
              var body = document.body || document.createElement('body'),
                  documentElement = document.documentElement,
                  documentOverflow = documentElement.style.overflow,
                  isCreatedBody = false;

              if (!document.body) {
                isCreatedBody = true;
                documentElement.style.overflow = 'hidden';
                documentElement.appendChild(body);
                body.style.overflow = 'hidden';
                body.style.background = '';
              }

              body.appendChild(element);
              element.style[jsProperty] = 'translate3d(1px,1px,1px)';
              propertyValue = window.getComputedStyle(element).getPropertyValue(cssProperty);
              featureSupport = propertyValue !== undefined && propertyValue.length > 0 && propertyValue !== 'none';
              documentElement.style.overflow = documentOverflow;
              body.removeChild(element);

              if (isCreatedBody) {
                body.removeAttribute('style');
                body.parentNode.removeChild(body);
              }
            }
            break;
        }
        return featureSupport;
      },
      css: function css(element, property, value) {
        var jsProperty = helpers.propertyCache[property];
        if (!jsProperty) {
          for (var i = 0, l = helpers.vendors.length; i < l; i++) {
            if (helpers.vendors[i] !== null) {
              jsProperty = helpers.camelCase(helpers.vendors[i][1] + '-' + property);
            } else {
              jsProperty = property;
            }
            if (element.style[jsProperty] !== undefined) {
              helpers.propertyCache[property] = jsProperty;
              break;
            }
          }
        }
        element.style[jsProperty] = value;
      }
    };

    var MAGIC_NUMBER = 30,
        DEFAULTS = {
      relativeInput: false,
      clipRelativeInput: false,
      inputElement: null,
      hoverOnly: false,
      calibrationThreshold: 100,
      calibrationDelay: 500,
      supportDelay: 500,
      calibrateX: false,
      calibrateY: true,
      invertX: true,
      invertY: true,
      limitX: false,
      limitY: false,
      scalarX: 10.0,
      scalarY: 10.0,
      frictionX: 0.1,
      frictionY: 0.1,
      originX: 0.5,
      originY: 0.5,
      pointerEvents: false,
      precision: 1,
      onReady: null,
      selector: null
    };

    var Parallax = function () {
      function Parallax(element, options) {
        _classCallCheck(this, Parallax);

        this.element = element;

        var data = {
          calibrateX: helpers.data(this.element, 'calibrate-x'),
          calibrateY: helpers.data(this.element, 'calibrate-y'),
          invertX: helpers.data(this.element, 'invert-x'),
          invertY: helpers.data(this.element, 'invert-y'),
          limitX: helpers.data(this.element, 'limit-x'),
          limitY: helpers.data(this.element, 'limit-y'),
          scalarX: helpers.data(this.element, 'scalar-x'),
          scalarY: helpers.data(this.element, 'scalar-y'),
          frictionX: helpers.data(this.element, 'friction-x'),
          frictionY: helpers.data(this.element, 'friction-y'),
          originX: helpers.data(this.element, 'origin-x'),
          originY: helpers.data(this.element, 'origin-y'),
          pointerEvents: helpers.data(this.element, 'pointer-events'),
          precision: helpers.data(this.element, 'precision'),
          relativeInput: helpers.data(this.element, 'relative-input'),
          clipRelativeInput: helpers.data(this.element, 'clip-relative-input'),
          hoverOnly: helpers.data(this.element, 'hover-only'),
          inputElement: document.querySelector(helpers.data(this.element, 'input-element')),
          selector: helpers.data(this.element, 'selector')
        };

        for (var key in data) {
          if (data[key] === null) {
            delete data[key];
          }
        }

        objectAssign(this, DEFAULTS, data, options);

        if (!this.inputElement) {
          this.inputElement = this.element;
        }

        this.calibrationTimer = null;
        this.calibrationFlag = true;
        this.enabled = false;
        this.depthsX = [];
        this.depthsY = [];
        this.raf = null;

        this.bounds = null;
        this.elementPositionX = 0;
        this.elementPositionY = 0;
        this.elementWidth = 0;
        this.elementHeight = 0;

        this.elementCenterX = 0;
        this.elementCenterY = 0;

        this.elementRangeX = 0;
        this.elementRangeY = 0;

        this.calibrationX = 0;
        this.calibrationY = 0;

        this.inputX = 0;
        this.inputY = 0;

        this.motionX = 0;
        this.motionY = 0;

        this.velocityX = 0;
        this.velocityY = 0;

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onDeviceOrientation = this.onDeviceOrientation.bind(this);
        this.onDeviceMotion = this.onDeviceMotion.bind(this);
        this.onOrientationTimer = this.onOrientationTimer.bind(this);
        this.onMotionTimer = this.onMotionTimer.bind(this);
        this.onCalibrationTimer = this.onCalibrationTimer.bind(this);
        this.onAnimationFrame = this.onAnimationFrame.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);

        this.windowWidth = null;
        this.windowHeight = null;
        this.windowCenterX = null;
        this.windowCenterY = null;
        this.windowRadiusX = null;
        this.windowRadiusY = null;
        this.portrait = false;
        this.desktop = !navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|BB10|mobi|tablet|opera mini|nexus 7)/i);
        this.motionSupport = !!window.DeviceMotionEvent && !this.desktop;
        this.orientationSupport = !!window.DeviceOrientationEvent && !this.desktop;
        this.orientationStatus = 0;
        this.motionStatus = 0;

        this.initialise();
      }

      _createClass(Parallax, [{
        key: 'initialise',
        value: function initialise() {
          if (this.transform2DSupport === undefined) {
            this.transform2DSupport = helpers.transformSupport('2D');
            this.transform3DSupport = helpers.transformSupport('3D');
          }

          // Configure Context Styles
          if (this.transform3DSupport) {
            helpers.accelerate(this.element);
          }

          var style = window.getComputedStyle(this.element);
          if (style.getPropertyValue('position') === 'static') {
            this.element.style.position = 'relative';
          }

          // Pointer events
          if (!this.pointerEvents) {
            this.element.style.pointerEvents = 'none';
          }

          // Setup
          this.updateLayers();
          this.updateDimensions();
          this.enable();
          this.queueCalibration(this.calibrationDelay);
        }
      }, {
        key: 'doReadyCallback',
        value: function doReadyCallback() {
          if (this.onReady) {
            this.onReady();
          }
        }
      }, {
        key: 'updateLayers',
        value: function updateLayers() {
          if (this.selector) {
            this.layers = this.element.querySelectorAll(this.selector);
          } else {
            this.layers = this.element.children;
          }

          if (!this.layers.length) {
            console.warn('ParallaxJS: Your scene does not have any layers.');
          }

          this.depthsX = [];
          this.depthsY = [];

          for (var index = 0; index < this.layers.length; index++) {
            var layer = this.layers[index];

            if (this.transform3DSupport) {
              helpers.accelerate(layer);
            }

            layer.style.position = index ? 'absolute' : 'relative';
            layer.style.display = 'block';
            layer.style.left = 0;
            layer.style.top = 0;

            var depth = helpers.data(layer, 'depth') || 0;
            this.depthsX.push(helpers.data(layer, 'depth-x') || depth);
            this.depthsY.push(helpers.data(layer, 'depth-y') || depth);
          }
        }
      }, {
        key: 'updateDimensions',
        value: function updateDimensions() {
          this.windowWidth = window.innerWidth;
          this.windowHeight = window.innerHeight;
          this.windowCenterX = this.windowWidth * this.originX;
          this.windowCenterY = this.windowHeight * this.originY;
          this.windowRadiusX = Math.max(this.windowCenterX, this.windowWidth - this.windowCenterX);
          this.windowRadiusY = Math.max(this.windowCenterY, this.windowHeight - this.windowCenterY);
        }
      }, {
        key: 'updateBounds',
        value: function updateBounds() {
          this.bounds = this.inputElement.getBoundingClientRect();
          this.elementPositionX = this.bounds.left;
          this.elementPositionY = this.bounds.top;
          this.elementWidth = this.bounds.width;
          this.elementHeight = this.bounds.height;
          this.elementCenterX = this.elementWidth * this.originX;
          this.elementCenterY = this.elementHeight * this.originY;
          this.elementRangeX = Math.max(this.elementCenterX, this.elementWidth - this.elementCenterX);
          this.elementRangeY = Math.max(this.elementCenterY, this.elementHeight - this.elementCenterY);
        }
      }, {
        key: 'queueCalibration',
        value: function queueCalibration(delay) {
          clearTimeout(this.calibrationTimer);
          this.calibrationTimer = setTimeout(this.onCalibrationTimer, delay);
        }
      }, {
        key: 'enable',
        value: function enable() {
          if (this.enabled) {
            return;
          }
          this.enabled = true;

          if (this.orientationSupport) {
            this.portrait = false;
            window.addEventListener('deviceorientation', this.onDeviceOrientation);
            this.detectionTimer = setTimeout(this.onOrientationTimer, this.supportDelay);
          } else if (this.motionSupport) {
            this.portrait = false;
            window.addEventListener('devicemotion', this.onDeviceMotion);
            this.detectionTimer = setTimeout(this.onMotionTimer, this.supportDelay);
          } else {
            this.calibrationX = 0;
            this.calibrationY = 0;
            this.portrait = false;
            window.addEventListener('mousemove', this.onMouseMove);
            this.doReadyCallback();
          }

          window.addEventListener('resize', this.onWindowResize);
          this.raf = rqAnFr(this.onAnimationFrame);
        }
      }, {
        key: 'disable',
        value: function disable() {
          if (!this.enabled) {
            return;
          }
          this.enabled = false;

          if (this.orientationSupport) {
            window.removeEventListener('deviceorientation', this.onDeviceOrientation);
          } else if (this.motionSupport) {
            window.removeEventListener('devicemotion', this.onDeviceMotion);
          } else {
            window.removeEventListener('mousemove', this.onMouseMove);
          }

          window.removeEventListener('resize', this.onWindowResize);
          rqAnFr.cancel(this.raf);
        }
      }, {
        key: 'calibrate',
        value: function calibrate(x, y) {
          this.calibrateX = x === undefined ? this.calibrateX : x;
          this.calibrateY = y === undefined ? this.calibrateY : y;
        }
      }, {
        key: 'invert',
        value: function invert(x, y) {
          this.invertX = x === undefined ? this.invertX : x;
          this.invertY = y === undefined ? this.invertY : y;
        }
      }, {
        key: 'friction',
        value: function friction(x, y) {
          this.frictionX = x === undefined ? this.frictionX : x;
          this.frictionY = y === undefined ? this.frictionY : y;
        }
      }, {
        key: 'scalar',
        value: function scalar(x, y) {
          this.scalarX = x === undefined ? this.scalarX : x;
          this.scalarY = y === undefined ? this.scalarY : y;
        }
      }, {
        key: 'limit',
        value: function limit(x, y) {
          this.limitX = x === undefined ? this.limitX : x;
          this.limitY = y === undefined ? this.limitY : y;
        }
      }, {
        key: 'origin',
        value: function origin(x, y) {
          this.originX = x === undefined ? this.originX : x;
          this.originY = y === undefined ? this.originY : y;
        }
      }, {
        key: 'setInputElement',
        value: function setInputElement(element) {
          this.inputElement = element;
          this.updateDimensions();
        }
      }, {
        key: 'setPosition',
        value: function setPosition(element, x, y) {
          x = x.toFixed(this.precision) + 'px';
          y = y.toFixed(this.precision) + 'px';
          if (this.transform3DSupport) {
            helpers.css(element, 'transform', 'translate3d(' + x + ',' + y + ',0)');
          } else if (this.transform2DSupport) {
            helpers.css(element, 'transform', 'translate(' + x + ',' + y + ')');
          } else {
            element.style.left = x;
            element.style.top = y;
          }
        }
      }, {
        key: 'onOrientationTimer',
        value: function onOrientationTimer() {
          if (this.orientationSupport && this.orientationStatus === 0) {
            this.disable();
            this.orientationSupport = false;
            this.enable();
          } else {
            this.doReadyCallback();
          }
        }
      }, {
        key: 'onMotionTimer',
        value: function onMotionTimer() {
          if (this.motionSupport && this.motionStatus === 0) {
            this.disable();
            this.motionSupport = false;
            this.enable();
          } else {
            this.doReadyCallback();
          }
        }
      }, {
        key: 'onCalibrationTimer',
        value: function onCalibrationTimer() {
          this.calibrationFlag = true;
        }
      }, {
        key: 'onWindowResize',
        value: function onWindowResize() {
          this.updateDimensions();
        }
      }, {
        key: 'onAnimationFrame',
        value: function onAnimationFrame() {
          this.updateBounds();
          var calibratedInputX = this.inputX - this.calibrationX,
              calibratedInputY = this.inputY - this.calibrationY;
          if (Math.abs(calibratedInputX) > this.calibrationThreshold || Math.abs(calibratedInputY) > this.calibrationThreshold) {
            this.queueCalibration(0);
          }
          if (this.portrait) {
            this.motionX = this.calibrateX ? calibratedInputY : this.inputY;
            this.motionY = this.calibrateY ? calibratedInputX : this.inputX;
          } else {
            this.motionX = this.calibrateX ? calibratedInputX : this.inputX;
            this.motionY = this.calibrateY ? calibratedInputY : this.inputY;
          }
          this.motionX *= this.elementWidth * (this.scalarX / 100);
          this.motionY *= this.elementHeight * (this.scalarY / 100);
          if (!isNaN(parseFloat(this.limitX))) {
            this.motionX = helpers.clamp(this.motionX, -this.limitX, this.limitX);
          }
          if (!isNaN(parseFloat(this.limitY))) {
            this.motionY = helpers.clamp(this.motionY, -this.limitY, this.limitY);
          }
          this.velocityX += (this.motionX - this.velocityX) * this.frictionX;
          this.velocityY += (this.motionY - this.velocityY) * this.frictionY;
          for (var index = 0; index < this.layers.length; index++) {
            var layer = this.layers[index],
                depthX = this.depthsX[index],
                depthY = this.depthsY[index],
                xOffset = this.velocityX * (depthX * (this.invertX ? -1 : 1)),
                yOffset = this.velocityY * (depthY * (this.invertY ? -1 : 1));
            this.setPosition(layer, xOffset, yOffset);
          }
          this.raf = rqAnFr(this.onAnimationFrame);
        }
      }, {
        key: 'rotate',
        value: function rotate(beta, gamma) {
          // Extract Rotation
          var x = (beta || 0) / MAGIC_NUMBER,
              //  -90 :: 90
          y = (gamma || 0) / MAGIC_NUMBER; // -180 :: 180

          // Detect Orientation Change
          var portrait = this.windowHeight > this.windowWidth;
          if (this.portrait !== portrait) {
            this.portrait = portrait;
            this.calibrationFlag = true;
          }

          if (this.calibrationFlag) {
            this.calibrationFlag = false;
            this.calibrationX = x;
            this.calibrationY = y;
          }

          this.inputX = x;
          this.inputY = y;
        }
      }, {
        key: 'onDeviceOrientation',
        value: function onDeviceOrientation(event) {
          var beta = event.beta;
          var gamma = event.gamma;
          if (beta !== null && gamma !== null) {
            this.orientationStatus = 1;
            this.rotate(beta, gamma);
          }
        }
      }, {
        key: 'onDeviceMotion',
        value: function onDeviceMotion(event) {
          var beta = event.rotationRate.beta;
          var gamma = event.rotationRate.gamma;
          if (beta !== null && gamma !== null) {
            this.motionStatus = 1;
            this.rotate(beta, gamma);
          }
        }
      }, {
        key: 'onMouseMove',
        value: function onMouseMove(event) {
          var clientX = event.clientX,
              clientY = event.clientY;

          // reset input to center if hoverOnly is set and we're not hovering the element
          if (this.hoverOnly && (clientX < this.elementPositionX || clientX > this.elementPositionX + this.elementWidth || clientY < this.elementPositionY || clientY > this.elementPositionY + this.elementHeight)) {
            this.inputX = 0;
            this.inputY = 0;
            return;
          }

          if (this.relativeInput) {
            // Clip mouse coordinates inside element bounds.
            if (this.clipRelativeInput) {
              clientX = Math.max(clientX, this.elementPositionX);
              clientX = Math.min(clientX, this.elementPositionX + this.elementWidth);
              clientY = Math.max(clientY, this.elementPositionY);
              clientY = Math.min(clientY, this.elementPositionY + this.elementHeight);
            }
            // Calculate input relative to the element.
            if (this.elementRangeX && this.elementRangeY) {
              this.inputX = (clientX - this.elementPositionX - this.elementCenterX) / this.elementRangeX;
              this.inputY = (clientY - this.elementPositionY - this.elementCenterY) / this.elementRangeY;
            }
          } else {
            // Calculate input relative to the window.
            if (this.windowRadiusX && this.windowRadiusY) {
              this.inputX = (clientX - this.windowCenterX) / this.windowRadiusX;
              this.inputY = (clientY - this.windowCenterY) / this.windowRadiusY;
            }
          }
        }
      }, {
        key: 'destroy',
        value: function destroy() {
          this.disable();

          clearTimeout(this.calibrationTimer);
          clearTimeout(this.detectionTimer);

          this.element.removeAttribute('style');
          for (var index = 0; index < this.layers.length; index++) {
            this.layers[index].removeAttribute('style');
          }

          delete this.element;
          delete this.layers;
        }
      }, {
        key: 'version',
        value: function version() {
          return '3.1.0';
        }
      }]);

      return Parallax;
    }();

    module.exports = Parallax;

    },{"object-assign":1,"raf":4}]},{},[5])(5)
    });

    });

    /* src/components/Iris.svelte generated by Svelte v3.18.2 */
    const file = "src/components/Iris.svelte";

    // (67:1) {#if polaroid1}
    function create_if_block_2(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-1if38cd");
    			add_location(img, file, 68, 3, 2044);
    			attr_dev(section, "class", "fixed svelte-1if38cd");
    			add_location(section, file, 67, 2, 1958);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_3*/ ctx[14], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(67:1) {#if polaroid1}",
    		ctx
    	});

    	return block;
    }

    // (72:1) {#if polaroid2}
    function create_if_block_1(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-1if38cd");
    			add_location(img, file, 73, 2, 2228);
    			attr_dev(section, "class", "fixed svelte-1if38cd");
    			add_location(section, file, 72, 1, 2143);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_4*/ ctx[15], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(72:1) {#if polaroid2}",
    		ctx
    	});

    	return block;
    }

    // (77:2) {#if polaroid3}
    function create_if_block(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-1if38cd");
    			add_location(img, file, 78, 3, 2414);
    			attr_dev(section, "class", "fixed svelte-1if38cd");
    			add_location(section, file, 77, 2, 2328);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_5*/ ctx[16], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(77:2) {#if polaroid3}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let section;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div6;
    	let div0;
    	let img1;
    	let img1_src_value;
    	let t1;
    	let div1;
    	let img2;
    	let img2_src_value;
    	let t2;
    	let div2;
    	let img3;
    	let img3_src_value;
    	let t3;
    	let div3;
    	let img4;
    	let img4_src_value;
    	let t4;
    	let div4;
    	let img5;
    	let img5_src_value;
    	let t5;
    	let div5;
    	let img6;
    	let img6_src_value;
    	let ready_action;
    	let t6;
    	let t7;
    	let t8;
    	let t9;
    	let img7;
    	let img7_src_value;
    	let current;
    	let dispose;
    	let if_block0 = /*polaroid1*/ ctx[0] && create_if_block_2(ctx);
    	let if_block1 = /*polaroid2*/ ctx[1] && create_if_block_1(ctx);
    	let if_block2 = /*polaroid3*/ ctx[2] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			section = element("section");
    			img0 = element("img");
    			t0 = space();
    			div6 = element("div");
    			div0 = element("div");
    			img1 = element("img");
    			t1 = space();
    			div1 = element("div");
    			img2 = element("img");
    			t2 = space();
    			div2 = element("div");
    			img3 = element("img");
    			t3 = space();
    			div3 = element("div");
    			img4 = element("img");
    			t4 = space();
    			div4 = element("div");
    			img5 = element("img");
    			t5 = space();
    			div5 = element("div");
    			img6 = element("img");
    			t6 = space();
    			if (if_block0) if_block0.c();
    			t7 = space();
    			if (if_block1) if_block1.c();
    			t8 = space();
    			if (if_block2) if_block2.c();
    			t9 = space();
    			img7 = element("img");
    			if (img0.src !== (img0_src_value = /*backImage*/ ctx[6])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "class", "backImage svelte-1if38cd");
    			attr_dev(img0, "alt", "Background");
    			add_location(img0, file, 44, 3, 1010);
    			if (img1.src !== (img1_src_value = /*images*/ ctx[7][0])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "parallax");
    			attr_dev(img1, "class", "room svelte-1if38cd");
    			add_location(img1, file, 47, 6, 1150);
    			attr_dev(div0, "data-depth", ".13");
    			add_location(div0, file, 46, 4, 1121);
    			if (img2.src !== (img2_src_value = /*images*/ ctx[7][1])) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "parallax");
    			attr_dev(img2, "class", "mirror svelte-1if38cd");
    			add_location(img2, file, 50, 5, 1247);
    			attr_dev(div1, "data-depth", ".08");
    			add_location(div1, file, 49, 4, 1219);
    			if (img3.src !== (img3_src_value = /*images*/ ctx[7][2])) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "parallax");
    			attr_dev(img3, "class", "character svelte-1if38cd");
    			add_location(img3, file, 53, 6, 1413);
    			attr_dev(div2, "data-depth", ".18");
    			add_location(div2, file, 52, 4, 1384);
    			if (img4.src !== (img4_src_value = /*images*/ ctx[7][3])) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "parallax");
    			attr_dev(img4, "class", "computer svelte-1if38cd");
    			add_location(img4, file, 56, 6, 1579);
    			attr_dev(div3, "data-depth", ".13");
    			add_location(div3, file, 55, 4, 1550);
    			if (img5.src !== (img5_src_value = /*images*/ ctx[7][4])) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "parallax");
    			attr_dev(img5, "class", "forground1 svelte-1if38cd");
    			add_location(img5, file, 59, 6, 1745);
    			attr_dev(div4, "data-depth", ".08");
    			add_location(div4, file, 58, 4, 1716);
    			if (img6.src !== (img6_src_value = /*images*/ ctx[7][5])) attr_dev(img6, "src", img6_src_value);
    			attr_dev(img6, "alt", "parallax");
    			attr_dev(img6, "class", "forground2 svelte-1if38cd");
    			add_location(img6, file, 62, 6, 1847);
    			attr_dev(div5, "data-depth", ".12");
    			add_location(div5, file, 61, 4, 1818);
    			attr_dev(div6, "data-pointer-events", "true");
    			add_location(div6, file, 45, 3, 1074);
    			attr_dev(section, "class", "svelte-1if38cd");
    			add_location(section, file, 43, 2, 997);
    			attr_dev(main, "class", "svelte-1if38cd");
    			add_location(main, file, 42, 0, 987);
    			if (img7.src !== (img7_src_value = /*doorIcon*/ ctx[5])) attr_dev(img7, "src", img7_src_value);
    			attr_dev(img7, "alt", "doorIcon");
    			attr_dev(img7, "class", "door-icon svelte-1if38cd");
    			add_location(img7, file, 83, 0, 2504);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, section);
    			append_dev(section, img0);
    			append_dev(section, t0);
    			append_dev(section, div6);
    			append_dev(div6, div0);
    			append_dev(div0, img1);
    			append_dev(div6, t1);
    			append_dev(div6, div1);
    			append_dev(div1, img2);
    			append_dev(div6, t2);
    			append_dev(div6, div2);
    			append_dev(div2, img3);
    			append_dev(div6, t3);
    			append_dev(div6, div3);
    			append_dev(div3, img4);
    			append_dev(div6, t4);
    			append_dev(div6, div4);
    			append_dev(div4, img5);
    			append_dev(div6, t5);
    			append_dev(div6, div5);
    			append_dev(div5, img6);
    			append_dev(main, t6);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t7);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t8);
    			if (if_block2) if_block2.m(main, null);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, img7, anchor);
    			current = true;

    			dispose = [
    				listen_dev(img2, "click", /*click_handler*/ ctx[11], false, false, false),
    				listen_dev(img3, "click", /*click_handler_1*/ ctx[12], false, false, false),
    				listen_dev(img4, "click", /*click_handler_2*/ ctx[13], false, false, false),
    				action_destroyer(ready_action = /*ready*/ ctx[9].call(null, div6)),
    				listen_dev(img7, "click", /*click_handler_6*/ ctx[17], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*polaroid1*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    					transition_in(if_block0, 1);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(main, t7);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*polaroid2*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    					transition_in(if_block1, 1);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, t8);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*polaroid3*/ ctx[2]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    					transition_in(if_block2, 1);
    				} else {
    					if_block2 = create_if_block(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(main, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(img7);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let doorIcon = "./images/door_icon.png";
    	let polaroid1 = "";
    	let polaroid2 = "";
    	let polaroid3 = "";
    	let backImage = "./images/Iris/iris_background.PNG";

    	let images = [
    		"./images/Iris/iris_room.PNG",
    		"./images/Iris/iris_mirror.PNG",
    		"./images/Iris/iris_character.PNG",
    		"./images/Iris/iris_computer.PNG",
    		"./images/Iris/iris_forground1.PNG",
    		"./images/Iris/iris_forground2.PNG"
    	];

    	let polaroid = [
    		"./images/Iris/iris_polaroid1.PNG",
    		"./images/Iris/iris_polaroid2.PNG",
    		"./images/Iris/iris_polaroid3.PNG"
    	];

    	let parallaxInstance;

    	const ready = node => {
    		parallaxInstance = new parallax(node);
    		parallaxInstance.scalar(20);
    		parallaxInstance.invert(false, false);
    	};

    	const click_handler = () => {
    		$$invalidate(0, polaroid1 = active ? polaroid1 : !polaroid1);
    	};

    	const click_handler_1 = () => {
    		$$invalidate(1, polaroid2 = active ? polaroid2 : !polaroid2);
    	};

    	const click_handler_2 = () => {
    		$$invalidate(2, polaroid3 = active ? polaroid3 : !polaroid3);
    	};

    	const click_handler_3 = () => $$invalidate(0, polaroid1 = !polaroid1);
    	const click_handler_4 = () => $$invalidate(1, polaroid2 = !polaroid2);
    	const click_handler_5 = () => $$invalidate(2, polaroid3 = !polaroid3);
    	const click_handler_6 = () => dispatch("hideMe");

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("doorIcon" in $$props) $$invalidate(5, doorIcon = $$props.doorIcon);
    		if ("polaroid1" in $$props) $$invalidate(0, polaroid1 = $$props.polaroid1);
    		if ("polaroid2" in $$props) $$invalidate(1, polaroid2 = $$props.polaroid2);
    		if ("polaroid3" in $$props) $$invalidate(2, polaroid3 = $$props.polaroid3);
    		if ("backImage" in $$props) $$invalidate(6, backImage = $$props.backImage);
    		if ("images" in $$props) $$invalidate(7, images = $$props.images);
    		if ("polaroid" in $$props) $$invalidate(8, polaroid = $$props.polaroid);
    		if ("parallaxInstance" in $$props) parallaxInstance = $$props.parallaxInstance;
    		if ("active" in $$props) $$invalidate(3, active = $$props.active);
    	};

    	let active;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*polaroid1, polaroid2, polaroid3*/ 7) {
    			 $$invalidate(3, active = polaroid1 || polaroid2 || polaroid3 ? true : false);
    		}
    	};

    	return [
    		polaroid1,
    		polaroid2,
    		polaroid3,
    		active,
    		dispatch,
    		doorIcon,
    		backImage,
    		images,
    		polaroid,
    		ready,
    		parallaxInstance,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6
    	];
    }

    class Iris extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Iris",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/components/Caroline.svelte generated by Svelte v3.18.2 */
    const file$1 = "src/components/Caroline.svelte";

    // (81:4) {#if polaroid1}
    function create_if_block_2$1(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-2irrjq");
    			add_location(img, file$1, 82, 4, 2653);
    			attr_dev(section, "class", "fixed svelte-2irrjq");
    			add_location(section, file$1, 81, 7, 2566);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_3*/ ctx[14], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(81:4) {#if polaroid1}",
    		ctx
    	});

    	return block;
    }

    // (86:4) {#if polaroid2}
    function create_if_block_1$1(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-2irrjq");
    			add_location(img, file$1, 87, 4, 2852);
    			attr_dev(section, "class", "fixed svelte-2irrjq");
    			add_location(section, file$1, 86, 7, 2765);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_4*/ ctx[15], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(86:4) {#if polaroid2}",
    		ctx
    	});

    	return block;
    }

    // (91:4) {#if polaroid3}
    function create_if_block$1(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-2irrjq");
    			add_location(img, file$1, 92, 4, 3051);
    			attr_dev(section, "class", "fixed svelte-2irrjq");
    			add_location(section, file$1, 91, 7, 2964);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_5*/ ctx[16], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(91:4) {#if polaroid3}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let section;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div10;
    	let div0;
    	let img1;
    	let img1_src_value;
    	let t1;
    	let div1;
    	let img2;
    	let img2_src_value;
    	let t2;
    	let div2;
    	let img3;
    	let img3_src_value;
    	let t3;
    	let div3;
    	let img4;
    	let img4_src_value;
    	let t4;
    	let div4;
    	let img5;
    	let img5_src_value;
    	let t5;
    	let div5;
    	let img6;
    	let img6_src_value;
    	let t6;
    	let div6;
    	let img7;
    	let img7_src_value;
    	let t7;
    	let div7;
    	let img8;
    	let img8_src_value;
    	let t8;
    	let div8;
    	let img9;
    	let img9_src_value;
    	let t9;
    	let div9;
    	let img10;
    	let img10_src_value;
    	let ready_action;
    	let t10;
    	let t11;
    	let t12;
    	let t13;
    	let img11;
    	let img11_src_value;
    	let current;
    	let dispose;
    	let if_block0 = /*polaroid1*/ ctx[0] && create_if_block_2$1(ctx);
    	let if_block1 = /*polaroid2*/ ctx[1] && create_if_block_1$1(ctx);
    	let if_block2 = /*polaroid3*/ ctx[2] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			section = element("section");
    			img0 = element("img");
    			t0 = space();
    			div10 = element("div");
    			div0 = element("div");
    			img1 = element("img");
    			t1 = space();
    			div1 = element("div");
    			img2 = element("img");
    			t2 = space();
    			div2 = element("div");
    			img3 = element("img");
    			t3 = space();
    			div3 = element("div");
    			img4 = element("img");
    			t4 = space();
    			div4 = element("div");
    			img5 = element("img");
    			t5 = space();
    			div5 = element("div");
    			img6 = element("img");
    			t6 = space();
    			div6 = element("div");
    			img7 = element("img");
    			t7 = space();
    			div7 = element("div");
    			img8 = element("img");
    			t8 = space();
    			div8 = element("div");
    			img9 = element("img");
    			t9 = space();
    			div9 = element("div");
    			img10 = element("img");
    			t10 = space();
    			if (if_block0) if_block0.c();
    			t11 = space();
    			if (if_block1) if_block1.c();
    			t12 = space();
    			if (if_block2) if_block2.c();
    			t13 = space();
    			img11 = element("img");
    			if (img0.src !== (img0_src_value = /*backImage*/ ctx[6])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "class", "backImage svelte-2irrjq");
    			attr_dev(img0, "alt", "Background");
    			add_location(img0, file$1, 46, 3, 1239);
    			if (img1.src !== (img1_src_value = /*images*/ ctx[7][0])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "parallax");
    			attr_dev(img1, "class", "room svelte-2irrjq");
    			add_location(img1, file$1, 49, 6, 1378);
    			attr_dev(div0, "data-depth", ".1");
    			add_location(div0, file$1, 48, 4, 1350);
    			if (img2.src !== (img2_src_value = /*images*/ ctx[7][1])) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "parallax");
    			attr_dev(img2, "class", "drink svelte-2irrjq");
    			add_location(img2, file$1, 52, 6, 1476);
    			attr_dev(div1, "data-depth", ".15");
    			add_location(div1, file$1, 51, 4, 1447);
    			if (img3.src !== (img3_src_value = /*images*/ ctx[7][2])) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "parallax");
    			attr_dev(img3, "class", "food svelte-2irrjq");
    			add_location(img3, file$1, 55, 6, 1639);
    			attr_dev(div2, "data-depth", ".12");
    			add_location(div2, file$1, 54, 4, 1610);
    			if (img4.src !== (img4_src_value = /*images*/ ctx[7][3])) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "parallax");
    			attr_dev(img4, "class", "clothes svelte-2irrjq");
    			add_location(img4, file$1, 58, 6, 1801);
    			attr_dev(div3, "data-depth", ".11");
    			add_location(div3, file$1, 57, 4, 1772);
    			if (img5.src !== (img5_src_value = /*images*/ ctx[7][4])) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "parallax");
    			attr_dev(img5, "class", "character svelte-2irrjq");
    			add_location(img5, file$1, 61, 6, 1965);
    			attr_dev(div4, "data-depth", ".12");
    			add_location(div4, file$1, 60, 4, 1936);
    			if (img6.src !== (img6_src_value = /*images*/ ctx[7][5])) attr_dev(img6, "src", img6_src_value);
    			attr_dev(img6, "alt", "parallax");
    			attr_dev(img6, "class", "bed svelte-2irrjq");
    			add_location(img6, file$1, 64, 6, 2066);
    			attr_dev(div5, "data-depth", ".08");
    			add_location(div5, file$1, 63, 4, 2037);
    			if (img7.src !== (img7_src_value = /*images*/ ctx[7][6])) attr_dev(img7, "src", img7_src_value);
    			attr_dev(img7, "alt", "parallax");
    			attr_dev(img7, "class", "plant svelte-2irrjq");
    			add_location(img7, file$1, 67, 6, 2161);
    			attr_dev(div6, "data-depth", ".12");
    			add_location(div6, file$1, 66, 4, 2132);
    			if (img8.src !== (img8_src_value = /*images*/ ctx[7][7])) attr_dev(img8, "src", img8_src_value);
    			attr_dev(img8, "alt", "parallax");
    			attr_dev(img8, "class", "table svelte-2irrjq");
    			add_location(img8, file$1, 70, 6, 2258);
    			attr_dev(div7, "data-depth", ".12");
    			add_location(div7, file$1, 69, 4, 2229);
    			if (img9.src !== (img9_src_value = /*images*/ ctx[7][8])) attr_dev(img9, "src", img9_src_value);
    			attr_dev(img9, "alt", "parallax");
    			attr_dev(img9, "class", "pillow svelte-2irrjq");
    			add_location(img9, file$1, 73, 6, 2355);
    			attr_dev(div8, "data-depth", ".12");
    			add_location(div8, file$1, 72, 4, 2326);
    			if (img10.src !== (img10_src_value = /*images*/ ctx[7][9])) attr_dev(img10, "src", img10_src_value);
    			attr_dev(img10, "alt", "parallax");
    			attr_dev(img10, "class", "sofa svelte-2irrjq");
    			add_location(img10, file$1, 76, 6, 2453);
    			attr_dev(div9, "data-depth", ".12");
    			add_location(div9, file$1, 75, 4, 2424);
    			attr_dev(div10, "data-pointer-events", "true");
    			add_location(div10, file$1, 47, 3, 1303);
    			attr_dev(section, "class", "svelte-2irrjq");
    			add_location(section, file$1, 45, 2, 1226);
    			attr_dev(main, "class", "svelte-2irrjq");
    			add_location(main, file$1, 44, 0, 1216);
    			if (img11.src !== (img11_src_value = /*doorIcon*/ ctx[5])) attr_dev(img11, "src", img11_src_value);
    			attr_dev(img11, "alt", "doorIcon");
    			attr_dev(img11, "class", "door-icon svelte-2irrjq");
    			add_location(img11, file$1, 96, 0, 3144);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, section);
    			append_dev(section, img0);
    			append_dev(section, t0);
    			append_dev(section, div10);
    			append_dev(div10, div0);
    			append_dev(div0, img1);
    			append_dev(div10, t1);
    			append_dev(div10, div1);
    			append_dev(div1, img2);
    			append_dev(div10, t2);
    			append_dev(div10, div2);
    			append_dev(div2, img3);
    			append_dev(div10, t3);
    			append_dev(div10, div3);
    			append_dev(div3, img4);
    			append_dev(div10, t4);
    			append_dev(div10, div4);
    			append_dev(div4, img5);
    			append_dev(div10, t5);
    			append_dev(div10, div5);
    			append_dev(div5, img6);
    			append_dev(div10, t6);
    			append_dev(div10, div6);
    			append_dev(div6, img7);
    			append_dev(div10, t7);
    			append_dev(div10, div7);
    			append_dev(div7, img8);
    			append_dev(div10, t8);
    			append_dev(div10, div8);
    			append_dev(div8, img9);
    			append_dev(div10, t9);
    			append_dev(div10, div9);
    			append_dev(div9, img10);
    			append_dev(main, t10);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t11);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t12);
    			if (if_block2) if_block2.m(main, null);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, img11, anchor);
    			current = true;

    			dispose = [
    				listen_dev(img2, "click", /*click_handler*/ ctx[11], false, false, false),
    				listen_dev(img3, "click", /*click_handler_1*/ ctx[12], false, false, false),
    				listen_dev(img4, "click", /*click_handler_2*/ ctx[13], false, false, false),
    				action_destroyer(ready_action = /*ready*/ ctx[9].call(null, div10)),
    				listen_dev(img11, "click", /*click_handler_6*/ ctx[17], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*polaroid1*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    					transition_in(if_block0, 1);
    				} else {
    					if_block0 = create_if_block_2$1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(main, t11);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*polaroid2*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    					transition_in(if_block1, 1);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, t12);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*polaroid3*/ ctx[2]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    					transition_in(if_block2, 1);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(main, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(img11);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let polaroid1 = "";
    	let polaroid2 = "";
    	let polaroid3 = "";
    	let doorIcon = "./images/door_icon.png";
    	let backImage = "./images/Caroline/caroline_background.png";

    	let images = [
    		"./images/Caroline/caroline_room.png",
    		"./images/Caroline/caroline_drink.png",
    		"./images/Caroline/caroline_food.png",
    		"./images/Caroline/caroline_clothes.png",
    		"./images/Caroline/caroline_character.png",
    		"./images/Caroline/caroline_bed.png",
    		"./images/Caroline/caroline_plant.png",
    		"./images/Caroline/caroline_table.png",
    		"./images/Caroline/caroline_pillow.png",
    		"./images/Caroline/caroline_sofa.png"
    	];

    	let polaroid = [
    		"./images/Caroline/caroline_polaroid1.png",
    		"./images/Caroline/caroline_polaroid2.png",
    		"./images/Caroline/caroline_polaroid3.png"
    	];

    	let parallaxInstance;

    	const ready = node => {
    		parallaxInstance = new parallax(node);
    		parallaxInstance.scalar(20);
    		parallaxInstance.invert(false, false);
    	};

    	const click_handler = () => {
    		$$invalidate(1, polaroid2 = active ? polaroid2 : !polaroid2);
    	};

    	const click_handler_1 = () => {
    		$$invalidate(2, polaroid3 = active ? polaroid3 : !polaroid3);
    	};

    	const click_handler_2 = () => {
    		$$invalidate(0, polaroid1 = active ? polaroid1 : !polaroid1);
    	};

    	const click_handler_3 = () => $$invalidate(0, polaroid1 = !polaroid1);
    	const click_handler_4 = () => $$invalidate(1, polaroid2 = !polaroid2);
    	const click_handler_5 = () => $$invalidate(2, polaroid3 = !polaroid3);
    	const click_handler_6 = () => dispatch("hideMe");

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("polaroid1" in $$props) $$invalidate(0, polaroid1 = $$props.polaroid1);
    		if ("polaroid2" in $$props) $$invalidate(1, polaroid2 = $$props.polaroid2);
    		if ("polaroid3" in $$props) $$invalidate(2, polaroid3 = $$props.polaroid3);
    		if ("doorIcon" in $$props) $$invalidate(5, doorIcon = $$props.doorIcon);
    		if ("backImage" in $$props) $$invalidate(6, backImage = $$props.backImage);
    		if ("images" in $$props) $$invalidate(7, images = $$props.images);
    		if ("polaroid" in $$props) $$invalidate(8, polaroid = $$props.polaroid);
    		if ("parallaxInstance" in $$props) parallaxInstance = $$props.parallaxInstance;
    		if ("active" in $$props) $$invalidate(3, active = $$props.active);
    	};

    	let active;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*polaroid1, polaroid2, polaroid3*/ 7) {
    			 $$invalidate(3, active = polaroid1 || polaroid2 || polaroid3 ? true : false);
    		}
    	};

    	return [
    		polaroid1,
    		polaroid2,
    		polaroid3,
    		active,
    		dispatch,
    		doorIcon,
    		backImage,
    		images,
    		polaroid,
    		ready,
    		parallaxInstance,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6
    	];
    }

    class Caroline extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Caroline",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/components/Ena.svelte generated by Svelte v3.18.2 */
    const file$2 = "src/components/Ena.svelte";

    // (80:2) {#if polaroid1}
    function create_if_block_2$2(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-1iwwyhj");
    			add_location(img, file$2, 81, 4, 2606);
    			attr_dev(section, "class", "fixed svelte-1iwwyhj");
    			add_location(section, file$2, 80, 3, 2519);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_4*/ ctx[15], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(80:2) {#if polaroid1}",
    		ctx
    	});

    	return block;
    }

    // (85:2) {#if polaroid2}
    function create_if_block_1$2(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-1iwwyhj");
    			add_location(img, file$2, 86, 4, 2797);
    			attr_dev(section, "class", "fixed svelte-1iwwyhj");
    			add_location(section, file$2, 85, 3, 2710);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_5*/ ctx[16], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(85:2) {#if polaroid2}",
    		ctx
    	});

    	return block;
    }

    // (90:2) {#if polaroid3}
    function create_if_block$2(ctx) {
    	let section;
    	let img;
    	let img_src_value;
    	let section_intro;
    	let section_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			img = element("img");
    			if (img.src !== (img_src_value = /*polaroid*/ ctx[8][2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "polaroid");
    			attr_dev(img, "class", "polaroid1 svelte-1iwwyhj");
    			add_location(img, file$2, 91, 4, 2988);
    			attr_dev(section, "class", "fixed svelte-1iwwyhj");
    			add_location(section, file$2, 90, 3, 2901);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, img);
    			current = true;
    			dispose = listen_dev(section, "click", /*click_handler_6*/ ctx[17], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, {});
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(90:2) {#if polaroid3}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;
    	let section;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div10;
    	let div0;
    	let img1;
    	let img1_src_value;
    	let t1;
    	let div1;
    	let img2;
    	let img2_src_value;
    	let t2;
    	let div2;
    	let img3;
    	let img3_src_value;
    	let t3;
    	let div3;
    	let img4;
    	let img4_src_value;
    	let t4;
    	let div4;
    	let img5;
    	let img5_src_value;
    	let t5;
    	let div5;
    	let img6;
    	let img6_src_value;
    	let t6;
    	let div6;
    	let img7;
    	let img7_src_value;
    	let t7;
    	let div7;
    	let img8;
    	let img8_src_value;
    	let t8;
    	let div8;
    	let img9;
    	let img9_src_value;
    	let t9;
    	let div9;
    	let img10;
    	let img10_src_value;
    	let ready_action;
    	let t10;
    	let t11;
    	let t12;
    	let t13;
    	let img11;
    	let img11_src_value;
    	let current;
    	let dispose;
    	let if_block0 = /*polaroid1*/ ctx[0] && create_if_block_2$2(ctx);
    	let if_block1 = /*polaroid2*/ ctx[1] && create_if_block_1$2(ctx);
    	let if_block2 = /*polaroid3*/ ctx[2] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			section = element("section");
    			img0 = element("img");
    			t0 = space();
    			div10 = element("div");
    			div0 = element("div");
    			img1 = element("img");
    			t1 = space();
    			div1 = element("div");
    			img2 = element("img");
    			t2 = space();
    			div2 = element("div");
    			img3 = element("img");
    			t3 = space();
    			div3 = element("div");
    			img4 = element("img");
    			t4 = space();
    			div4 = element("div");
    			img5 = element("img");
    			t5 = space();
    			div5 = element("div");
    			img6 = element("img");
    			t6 = space();
    			div6 = element("div");
    			img7 = element("img");
    			t7 = space();
    			div7 = element("div");
    			img8 = element("img");
    			t8 = space();
    			div8 = element("div");
    			img9 = element("img");
    			t9 = space();
    			div9 = element("div");
    			img10 = element("img");
    			t10 = space();
    			if (if_block0) if_block0.c();
    			t11 = space();
    			if (if_block1) if_block1.c();
    			t12 = space();
    			if (if_block2) if_block2.c();
    			t13 = space();
    			img11 = element("img");
    			if (img0.src !== (img0_src_value = /*backImage*/ ctx[6])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "class", "backImage svelte-1iwwyhj");
    			attr_dev(img0, "alt", "Background");
    			add_location(img0, file$2, 45, 3, 1125);
    			if (img1.src !== (img1_src_value = /*images*/ ctx[7][0])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "parallax");
    			attr_dev(img1, "class", "room svelte-1iwwyhj");
    			add_location(img1, file$2, 48, 6, 1264);
    			attr_dev(div0, "data-depth", ".1");
    			add_location(div0, file$2, 47, 4, 1236);
    			if (img2.src !== (img2_src_value = /*images*/ ctx[7][2])) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "parallax");
    			attr_dev(img2, "class", "carpet svelte-1iwwyhj");
    			add_location(img2, file$2, 51, 6, 1362);
    			attr_dev(div1, "data-depth", ".15");
    			add_location(div1, file$2, 50, 4, 1333);
    			if (img3.src !== (img3_src_value = /*images*/ ctx[7][3])) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "parallax");
    			attr_dev(img3, "class", "sacco svelte-1iwwyhj");
    			add_location(img3, file$2, 54, 6, 1460);
    			attr_dev(div2, "data-depth", ".12");
    			add_location(div2, file$2, 53, 4, 1431);
    			if (img4.src !== (img4_src_value = /*images*/ ctx[7][9])) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "parallax");
    			attr_dev(img4, "class", "cat svelte-1iwwyhj");
    			add_location(img4, file$2, 57, 6, 1622);
    			attr_dev(div3, "data-depth", ".14");
    			add_location(div3, file$2, 56, 4, 1593);
    			if (img5.src !== (img5_src_value = /*images*/ ctx[7][6])) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "parallax");
    			attr_dev(img5, "class", "pillow svelte-1iwwyhj");
    			add_location(img5, file$2, 60, 6, 1782);
    			attr_dev(div4, "data-depth", ".12");
    			add_location(div4, file$2, 59, 4, 1753);
    			if (img6.src !== (img6_src_value = /*images*/ ctx[7][4])) attr_dev(img6, "src", img6_src_value);
    			attr_dev(img6, "alt", "parallax");
    			attr_dev(img6, "class", "bottle svelte-1iwwyhj");
    			add_location(img6, file$2, 63, 6, 1880);
    			attr_dev(div5, "data-depth", ".18");
    			add_location(div5, file$2, 62, 4, 1851);
    			if (img7.src !== (img7_src_value = /*images*/ ctx[7][5])) attr_dev(img7, "src", img7_src_value);
    			attr_dev(img7, "alt", "parallax");
    			attr_dev(img7, "class", "plant svelte-1iwwyhj");
    			add_location(img7, file$2, 66, 6, 2044);
    			attr_dev(div6, "data-depth", ".22");
    			add_location(div6, file$2, 65, 4, 2015);
    			if (img8.src !== (img8_src_value = /*images*/ ctx[7][7])) attr_dev(img8, "src", img8_src_value);
    			attr_dev(img8, "alt", "parallax");
    			attr_dev(img8, "class", "tall-plant svelte-1iwwyhj");
    			add_location(img8, file$2, 69, 6, 2141);
    			attr_dev(div7, "data-depth", ".07");
    			add_location(div7, file$2, 68, 4, 2112);
    			if (img9.src !== (img9_src_value = /*images*/ ctx[7][8])) attr_dev(img9, "src", img9_src_value);
    			attr_dev(img9, "alt", "parallax");
    			attr_dev(img9, "class", "character svelte-1iwwyhj");
    			add_location(img9, file$2, 72, 6, 2243);
    			attr_dev(div8, "data-depth", ".13");
    			add_location(div8, file$2, 71, 4, 2214);
    			if (img10.src !== (img10_src_value = /*images*/ ctx[7][1])) attr_dev(img10, "src", img10_src_value);
    			attr_dev(img10, "alt", "parallax");
    			attr_dev(img10, "class", "books svelte-1iwwyhj");
    			add_location(img10, file$2, 75, 5, 2409);
    			attr_dev(div9, "data-depth", ".28");
    			add_location(div9, file$2, 74, 4, 2381);
    			attr_dev(div10, "data-pointer-events", "true");
    			add_location(div10, file$2, 46, 3, 1189);
    			attr_dev(section, "class", "svelte-1iwwyhj");
    			add_location(section, file$2, 44, 2, 1112);
    			attr_dev(main, "class", "svelte-1iwwyhj");
    			add_location(main, file$2, 43, 0, 1102);
    			if (img11.src !== (img11_src_value = /*doorIcon*/ ctx[5])) attr_dev(img11, "src", img11_src_value);
    			attr_dev(img11, "alt", "doorIcon");
    			attr_dev(img11, "class", "door-icon svelte-1iwwyhj");
    			add_location(img11, file$2, 95, 0, 3079);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, section);
    			append_dev(section, img0);
    			append_dev(section, t0);
    			append_dev(section, div10);
    			append_dev(div10, div0);
    			append_dev(div0, img1);
    			append_dev(div10, t1);
    			append_dev(div10, div1);
    			append_dev(div1, img2);
    			append_dev(div10, t2);
    			append_dev(div10, div2);
    			append_dev(div2, img3);
    			append_dev(div10, t3);
    			append_dev(div10, div3);
    			append_dev(div3, img4);
    			append_dev(div10, t4);
    			append_dev(div10, div4);
    			append_dev(div4, img5);
    			append_dev(div10, t5);
    			append_dev(div10, div5);
    			append_dev(div5, img6);
    			append_dev(div10, t6);
    			append_dev(div10, div6);
    			append_dev(div6, img7);
    			append_dev(div10, t7);
    			append_dev(div10, div7);
    			append_dev(div7, img8);
    			append_dev(div10, t8);
    			append_dev(div10, div8);
    			append_dev(div8, img9);
    			append_dev(div10, t9);
    			append_dev(div10, div9);
    			append_dev(div9, img10);
    			append_dev(main, t10);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t11);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t12);
    			if (if_block2) if_block2.m(main, null);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, img11, anchor);
    			current = true;

    			dispose = [
    				listen_dev(img3, "click", /*click_handler*/ ctx[11], false, false, false),
    				listen_dev(img4, "click", /*click_handler_1*/ ctx[12], false, false, false),
    				listen_dev(img6, "click", /*click_handler_2*/ ctx[13], false, false, false),
    				listen_dev(img9, "click", /*click_handler_3*/ ctx[14], false, false, false),
    				action_destroyer(ready_action = /*ready*/ ctx[9].call(null, div10)),
    				listen_dev(img11, "click", /*click_handler_7*/ ctx[18], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*polaroid1*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    					transition_in(if_block0, 1);
    				} else {
    					if_block0 = create_if_block_2$2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(main, t11);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*polaroid2*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    					transition_in(if_block1, 1);
    				} else {
    					if_block1 = create_if_block_1$2(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, t12);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*polaroid3*/ ctx[2]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    					transition_in(if_block2, 1);
    				} else {
    					if_block2 = create_if_block$2(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(main, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(img11);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let polaroid1 = "";
    	let polaroid2 = "";
    	let polaroid3 = "";
    	let doorIcon = "./images/ena_exitDoor.png";
    	let backImage = "./images/Ena/ena_background.png";

    	let images = [
    		"./images/Ena/ena_room.gif",
    		"./images/Ena/ena_books_plushie.png",
    		"./images/Ena/ena_carpet.png",
    		"./images/Ena/ena_sacco.png",
    		"./images/Ena/ena_bottle.png",
    		"./images/Ena/ena_shiba_plant.png",
    		"./images/Ena/ena_table_pillow.png",
    		"./images/Ena/ena_tall_plant.png",
    		"./images/Ena/ena_character.gif",
    		"./images/Ena/ena_cat.gif"
    	];

    	let polaroid = [
    		"./images/Ena/ena_polaroid1.png",
    		"./images/Ena/ena_polaroid2.png",
    		"./images/Ena/ena_polaroid3.png"
    	];

    	let parallaxInstance;

    	const ready = node => {
    		parallaxInstance = new parallax(node);
    		parallaxInstance.scalar(20);
    		parallaxInstance.invert(false, false);
    	};

    	const click_handler = () => {
    		$$invalidate(1, polaroid2 = active ? polaroid2 : !polaroid2);
    	};

    	const click_handler_1 = () => {
    		$$invalidate(1, polaroid2 = active ? polaroid2 : !polaroid2);
    	};

    	const click_handler_2 = () => {
    		$$invalidate(0, polaroid1 = active ? polaroid1 : !polaroid1);
    	};

    	const click_handler_3 = () => {
    		$$invalidate(2, polaroid3 = active ? polaroid3 : !polaroid3);
    	};

    	const click_handler_4 = () => $$invalidate(0, polaroid1 = !polaroid1);
    	const click_handler_5 = () => $$invalidate(1, polaroid2 = !polaroid2);
    	const click_handler_6 = () => $$invalidate(2, polaroid3 = !polaroid3);
    	const click_handler_7 = () => dispatch("hideMe");

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("polaroid1" in $$props) $$invalidate(0, polaroid1 = $$props.polaroid1);
    		if ("polaroid2" in $$props) $$invalidate(1, polaroid2 = $$props.polaroid2);
    		if ("polaroid3" in $$props) $$invalidate(2, polaroid3 = $$props.polaroid3);
    		if ("doorIcon" in $$props) $$invalidate(5, doorIcon = $$props.doorIcon);
    		if ("backImage" in $$props) $$invalidate(6, backImage = $$props.backImage);
    		if ("images" in $$props) $$invalidate(7, images = $$props.images);
    		if ("polaroid" in $$props) $$invalidate(8, polaroid = $$props.polaroid);
    		if ("parallaxInstance" in $$props) parallaxInstance = $$props.parallaxInstance;
    		if ("active" in $$props) $$invalidate(3, active = $$props.active);
    	};

    	let active;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*polaroid1, polaroid2, polaroid3*/ 7) {
    			 $$invalidate(3, active = polaroid1 || polaroid2 || polaroid3 ? true : false);
    		}
    	};

    	return [
    		polaroid1,
    		polaroid2,
    		polaroid3,
    		active,
    		dispatch,
    		doorIcon,
    		backImage,
    		images,
    		polaroid,
    		ready,
    		parallaxInstance,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7
    	];
    }

    class Ena extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Ena",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/components/Clickable.svelte generated by Svelte v3.18.2 */
    const file$3 = "src/components/Clickable.svelte";

    // (31:2) {:else}
    function create_else_block(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let img_class_value;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (img.src !== (img_src_value = /*src*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "doors");
    			attr_dev(img, "class", img_class_value = "doors" + /*myNumber*/ ctx[0] + " svelte-1aby3ee");
    			add_location(img, file$3, 32, 10, 623);
    			attr_dev(div, "class", "clickable svelte-1aby3ee");
    			add_location(div, file$3, 31, 6, 571);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			dispose = listen_dev(div, "click", /*hideMe*/ ctx[3], false, false, false);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*src*/ 2 && img.src !== (img_src_value = /*src*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*myNumber*/ 1 && img_class_value !== (img_class_value = "doors" + /*myNumber*/ ctx[0] + " svelte-1aby3ee")) {
    				attr_dev(img, "class", img_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(31:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (21:2) {#if show}
    function create_if_block$3(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let div_intro;
    	let div_outro;
    	let current;
    	const if_block_creators = [create_if_block_1$3, create_if_block_2$3, create_if_block_3];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*myNumber*/ ctx[0] === 0) return 0;
    		if (/*myNumber*/ ctx[0] === 1) return 1;
    		if (/*myNumber*/ ctx[0] === 2) return 2;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type_1(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div, "class", "room");
    			add_location(div, file$3, 21, 5, 281);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fade, {});
    				div_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			if (div_intro) div_intro.invalidate();
    			div_outro = create_out_transition(div, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			if (detaching && div_outro) div_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(21:2) {#if show}",
    		ctx
    	});

    	return block;
    }

    // (27:34) 
    function create_if_block_3(ctx) {
    	let current;
    	const iris = new Iris({ $$inline: true });
    	iris.$on("hideMe", /*hideMe*/ ctx[3]);

    	const block = {
    		c: function create() {
    			create_component(iris.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(iris, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(iris.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(iris.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(iris, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(27:34) ",
    		ctx
    	});

    	return block;
    }

    // (25:34) 
    function create_if_block_2$3(ctx) {
    	let current;
    	const ena = new Ena({ $$inline: true });
    	ena.$on("hideMe", /*hideMe*/ ctx[3]);

    	const block = {
    		c: function create() {
    			create_component(ena.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(ena, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(ena.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(ena.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(ena, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(25:34) ",
    		ctx
    	});

    	return block;
    }

    // (23:6) {#if myNumber === 0}
    function create_if_block_1$3(ctx) {
    	let current;
    	const caroline = new Caroline({ $$inline: true });
    	caroline.$on("hideMe", /*hideMe*/ ctx[3]);

    	const block = {
    		c: function create() {
    			create_component(caroline.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(caroline, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(caroline.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(caroline.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(caroline, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(23:6) {#if myNumber === 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$3, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*show*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			add_location(main, file$3, 19, 0, 256);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { myNumber } = $$props, { src } = $$props;
    	let show = false;

    	const hideMe = () => {
    		$$invalidate(2, show = !show);
    	};

    	const writable_props = ["myNumber", "src"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Clickable> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("myNumber" in $$props) $$invalidate(0, myNumber = $$props.myNumber);
    		if ("src" in $$props) $$invalidate(1, src = $$props.src);
    	};

    	$$self.$capture_state = () => {
    		return { myNumber, src, show };
    	};

    	$$self.$inject_state = $$props => {
    		if ("myNumber" in $$props) $$invalidate(0, myNumber = $$props.myNumber);
    		if ("src" in $$props) $$invalidate(1, src = $$props.src);
    		if ("show" in $$props) $$invalidate(2, show = $$props.show);
    	};

    	return [myNumber, src, show, hideMe];
    }

    class Clickable extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { myNumber: 0, src: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Clickable",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*myNumber*/ ctx[0] === undefined && !("myNumber" in props)) {
    			console.warn("<Clickable> was created without expected prop 'myNumber'");
    		}

    		if (/*src*/ ctx[1] === undefined && !("src" in props)) {
    			console.warn("<Clickable> was created without expected prop 'src'");
    		}
    	}

    	get myNumber() {
    		throw new Error("<Clickable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set myNumber(value) {
    		throw new Error("<Clickable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get src() {
    		throw new Error("<Clickable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set src(value) {
    		throw new Error("<Clickable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Doors.svelte generated by Svelte v3.18.2 */
    const file$4 = "src/components/Doors.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	child_ctx[3] = i;
    	return child_ctx;
    }

    // (19:4) {#each doors as door, i}
    function create_each_block(ctx) {
    	let current;

    	const clickable = new Clickable({
    			props: {
    				src: /*doors*/ ctx[0][/*i*/ ctx[3]],
    				show: "hidden",
    				myNumber: /*i*/ ctx[3]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(clickable.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(clickable, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(clickable.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(clickable.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(clickable, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(19:4) {#each doors as door, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let link;
    	let t0;
    	let main;
    	let h1;
    	let t2;
    	let section;
    	let current;
    	let each_value = /*doors*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			link = element("link");
    			t0 = space();
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Overtenking";
    			t2 = space();
    			section = element("section");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(link, "href", "https://fonts.googleapis.com/css?family=Press+Start+2P&display=swap");
    			attr_dev(link, "rel", "stylesheet");
    			add_location(link, file$4, 12, 2, 206);
    			attr_dev(h1, "class", "svelte-bstlaj");
    			add_location(h1, file$4, 16, 2, 330);
    			attr_dev(section, "class", "doors svelte-bstlaj");
    			add_location(section, file$4, 17, 2, 353);
    			attr_dev(main, "class", "svelte-bstlaj");
    			add_location(main, file$4, 15, 0, 321);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, link);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t2);
    			append_dev(main, section);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*doors*/ 1) {
    				each_value = /*doors*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(section, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(link);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self) {
    	let doors = [
    		"./images/Caroline/caroline_door.png",
    		"./images/Ena/ena_door.png",
    		"./images/Iris/iris_door.PNG"
    	];

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("doors" in $$props) $$invalidate(0, doors = $$props.doors);
    	};

    	return [doors];
    }

    class Doors extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Doors",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.18.2 */
    const file$5 = "src/App.svelte";

    // (15:1) {#if status!=""}
    function create_if_block$4(ctx) {
    	let h1;
    	let t;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t = text(/*status*/ ctx[0]);
    			attr_dev(h1, "class", "svelte-10cduyy");
    			add_location(h1, file$5, 15, 2, 330);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*status*/ 1) set_data_dev(t, /*status*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(15:1) {#if status!=\\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let main;
    	let t0;
    	let audio;
    	let audio_src_value;
    	let t1;
    	let current;
    	const doors = new Doors({ $$inline: true });
    	let if_block = /*status*/ ctx[0] != "" && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(doors.$$.fragment);
    			t0 = space();
    			audio = element("audio");
    			t1 = space();
    			if (if_block) if_block.c();
    			if (audio.src !== (audio_src_value = /*sound*/ ctx[1])) attr_dev(audio, "src", audio_src_value);
    			audio.autoplay = true;
    			audio.loop = true;
    			add_location(audio, file$5, 13, 1, 268);
    			add_location(main, file$5, 11, 0, 249);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(doors, main, null);
    			append_dev(main, t0);
    			append_dev(main, audio);
    			append_dev(main, t1);
    			if (if_block) if_block.m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*status*/ ctx[0] != "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					if_block.m(main, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(doors.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(doors.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(doors);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let sound = "./lofi.mp3";
    	let status = "";
    	if (innerWidth / innerHeight < 1.4) status = "this page can only be viewed on a bigger screen...";
    	console.log(innerWidth / innerHeight, "hei");

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("sound" in $$props) $$invalidate(1, sound = $$props.sound);
    		if ("status" in $$props) $$invalidate(0, status = $$props.status);
    	};

    	return [status, sound];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
