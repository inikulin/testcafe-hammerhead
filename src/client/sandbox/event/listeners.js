import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import nativeMethods from '../native-methods';
import EventEmitter from '../../utils/event-emitter';
import * as listeningCtx from './listening-context';
import { preventDefault, stopPropagation, DOM_EVENTS, isObjectEventListener } from '../../utils/event';
import { isWindow } from '../../utils/dom';

const LISTENED_EVENTS = [
    'click', 'mousedown', 'mouseup', 'dblclick', 'contextmenu', 'mousemove', 'mouseover', 'mouseout',
    'pointerdown', 'pointermove', 'pointerover', 'pointerout', 'pointerup',
    'MSPointerDown', 'MSPointerMove', 'MSPointerOver', 'MSPointerOut', 'MSPointerUp',
    'touchstart', 'touchmove', 'touchend',
    'keydown', 'keypress', 'keyup',
    'change', 'focus', 'blur', 'focusin', 'focusout'
];

const EVENT_SANDBOX_DISPATCH_EVENT_FLAG = 'hammerhead|event-sandbox-dispatch-event-flag';

export default class Listeners extends EventEmitter {
    constructor () {
        super();

        this.EVENT_LISTENER_ATTACHED_EVENT = 'hammerhead|event|event-listener-attached';
        this.EVENT_LISTENER_DETACHED_EVENT = 'hammerhead|event|event-listener-detached';

        this.listeningCtx = listeningCtx;

        this.addInternalEventListener    = this.listeningCtx.addInternalHandler;
        this.addFirstInternalHandler     = this.listeningCtx.addFirstInternalHandler;
        this.removeInternalEventListener = this.listeningCtx.removeInternalHandler;
    }

    static _getBodyEventListenerWrapper (documentEventCtx, listener) {
        return function (e) {
            if (documentEventCtx.cancelOuterHandlers)
                return null;

            return listener.call(this, e);
        };
    }

    static _getNativeAddEventListener (el) {
        if (isWindow(el))
            return nativeMethods.windowAddEventListener;

        return el.body !== void 0 ? nativeMethods.documentAddEventListener : nativeMethods.addEventListener;
    }

    static _getNativeRemoveEventListener (el) {
        if (isWindow(el))
            return nativeMethods.windowRemoveEventListener;

        return el.body !== void 0 ? nativeMethods.documentRemoveEventListener : nativeMethods.removeEventListener;
    }

    static _getEventListenerWrapper (eventCtx, listener) {
        return function (e) {
            var isIEServiceHandler = listener.toString() === '[object FunctionWrapper]';

            // NOTE: Ignore IE11's and Edge's service handlers (GH-379)
            if (isIEServiceHandler)
                return null;

            if (eventCtx.cancelOuterHandlers)
                return null;

            if (typeof eventCtx.outerHandlersWrapper === 'function')
                return eventCtx.outerHandlersWrapper.call(this, e, listener);

            if (isObjectEventListener(listener))
                return listener.handleEvent.call(listener, e);

            return listener.call(this, e);
        };
    }

    static _isDifferentHandler (outerHandlers, listener, useCapture) {
        for (var i = 0, len = outerHandlers.length; i < len; i++) {
            if (outerHandlers[i].fn === listener && outerHandlers[i].useCapture === useCapture)
                return false;
        }

        return true;
    }

    _createEventHandler () {
        var listeners = this;

        return function (e) {
            var el                    = this;
            var elWindow              = el[INTERNAL_PROPS.processedContext] || window;
            var eventPrevented        = false;
            var handlersCancelled     = false;
            var stopPropagationCalled = false;
            var eventCtx              = listeners.listeningCtx.getEventCtx(el, e.type);
            var internalHandlers      = eventCtx ? eventCtx.internalHandlers : [];

            eventCtx.cancelOuterHandlers = false;

            var preventEvent = () => {
                eventPrevented = true;
                preventDefault(e);
            };

            var cancelHandlers = () => {
                if (!handlersCancelled)
                    eventCtx.cancelOuterHandlers = true;

                handlersCancelled = true;
            };

            var stopEventPropagation = () => {
                stopPropagationCalled = true;

                stopPropagation(e);
            };

            for (var i = 0; i < internalHandlers.length; i++) {
                internalHandlers[i].call(el, e, elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG], preventEvent, cancelHandlers, stopEventPropagation);

                if (eventPrevented || stopPropagationCalled)
                    break;
            }
        };
    }

    _createElementOverridedMethods (el) {
        var listeners = this;

        return {
            addEventListener: function (...args) {
                var type                   = args[0];
                var listener               = args[1];
                var useCapture             = args[2];
                var eventListeningInfo     = listeningCtx.getEventCtx(el, type);
                var nativeAddEventListener = Listeners._getNativeAddEventListener(el);

                if (!eventListeningInfo)
                    return nativeAddEventListener.apply(el, args);

                // NOTE: T233158
                var isDifferentHandler = Listeners._isDifferentHandler(eventListeningInfo.outerHandlers, listener, useCapture);

                if (!isDifferentHandler)
                    return null;

                var wrapper = Listeners._getEventListenerWrapper(eventListeningInfo, listener);

                listeningCtx.wrapEventListener(eventListeningInfo, listener, wrapper, useCapture);

                args[1] = wrapper;

                var res = nativeAddEventListener.apply(el, args);

                listeners.emit(listeners.EVENT_LISTENER_ATTACHED_EVENT, { el, listener, eventType: type });

                return res;
            },

            removeEventListener: function (...args) {
                var type                      = args[0];
                var listener                  = args[1];
                var useCapture                = args[2];
                var nativeRemoveEventListener = Listeners._getNativeRemoveEventListener(el);
                var eventCtx                  = listeningCtx.getEventCtx(el, type);

                if (!eventCtx)
                    return nativeRemoveEventListener.apply(el, args);

                args[1] = listeningCtx.getWrapper(eventCtx, listener, useCapture);

                var res = nativeRemoveEventListener.apply(el, args);

                listeners.emit(listeners.EVENT_LISTENER_DETACHED_EVENT, { el, listener, eventType: type });

                return res;
            }
        };
    }

    _createDocumentBodyOverridedMethods (doc) {
        var listeners                 = this;
        var nativeAddEventListener    = (() => doc.body.addEventListener)();
        var nativeRemoveEventListener = (() => doc.body.removeEventListener)();

        return {
            addEventListener: function (type, listener, useCapture) {
                var docEventListeningInfo = listeningCtx.getEventCtx(doc, type);
                var eventListeningInfo    = listeningCtx.getEventCtx(this, type);

                if (!docEventListeningInfo)
                    return nativeAddEventListener.call(this, type, listener, useCapture);

                // NOTE: T233158
                var isDifferentHandler = Listeners._isDifferentHandler(eventListeningInfo.outerHandlers, listener, useCapture);

                if (!isDifferentHandler)
                    return null;

                var wrapper = Listeners._getBodyEventListenerWrapper(docEventListeningInfo, listener);

                listeningCtx.wrapEventListener(eventListeningInfo, listener, wrapper, useCapture);

                var res = nativeAddEventListener.call(this, type, wrapper, useCapture);

                listeners.emit(listeners.EVENT_LISTENER_ATTACHED_EVENT, {
                    el:        this,
                    eventType: type,
                    listener:  listener
                });

                return res;
            },

            removeEventListener: function (type, listener, useCapture) {
                var eventListeningInfo = listeningCtx.getEventCtx(this, type);

                if (!eventListeningInfo)
                    return nativeRemoveEventListener.call(this, type, listener, useCapture);

                return nativeRemoveEventListener.call(this, type, listeningCtx.getWrapper(eventListeningInfo, listener, useCapture), useCapture);
            }
        };
    }

    initElementListening (el, events) {
        var nativeAddEventListener = Listeners._getNativeAddEventListener(el);

        events = events || LISTENED_EVENTS;

        this.listeningCtx.addListeningElement(el, events);

        for (var i = 0; i < events.length; i++)
            nativeAddEventListener.call(el, events[i], this._createEventHandler(), true);

        var overridedMethods = this._createElementOverridedMethods(el);

        el.addEventListener    = overridedMethods.addEventListener;
        el.removeEventListener = overridedMethods.removeEventListener;
    }

    initDocumentBodyListening (doc) {
        listeningCtx.addListeningElement(doc.body, DOM_EVENTS);

        var overridedMethods = this._createDocumentBodyOverridedMethods(doc);

        doc.body.addEventListener    = overridedMethods.addEventListener;
        doc.body.removeEventListener = overridedMethods.removeEventListener;
    }

    restartElementListening (el) {
        var nativeAddEventListener = Listeners._getNativeAddEventListener(el);
        var elementCtx             = this.listeningCtx.getElementCtx(el);

        if (elementCtx) {
            var eventNames = Object.keys(elementCtx);

            for (var i = 0, len = eventNames.length; i < len; i++)
                nativeAddEventListener.call(el, eventNames[i], this._createEventHandler(), true);
        }
    }

    cancelElementListening (el) {
        this.listeningCtx.removeListeningElement(el);

        if (el.body)
            this.listeningCtx.removeListeningElement(el.body);
    }

    static beforeDispatchEvent (el) {
        var elWindow = el[INTERNAL_PROPS.processedContext] || window;

        elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] = (elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] || 0) + 1;
    }

    static afterDispatchEvent (el) {
        var elWindow = el[INTERNAL_PROPS.processedContext] || window;

        elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG]--;

        if (!elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG])
            delete elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG];
    }

    setEventListenerWrapper (el, events, wrapper) {
        if (!this.listeningCtx.isElementListening(el))
            this.initElementListening(el, events);

        for (var i = 0; i < events.length; i++) {
            var eventListeningInfo = this.listeningCtx.getEventCtx(el, events[i]);

            eventListeningInfo.outerHandlersWrapper = wrapper;
        }
    }
}
