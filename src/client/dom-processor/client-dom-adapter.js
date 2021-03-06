import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import EventEmitter from '../utils/event-emitter';
import BaseDomAdapter from '../../processing/dom/base-dom-adapter';
import nativeMethods from '../sandbox/native-methods';
import settings from '../settings';
import { sameOriginCheck } from '../utils/destination-location';
import { getProxyUrl } from '../utils/url';
import { isIE9 } from '../utils/browser';
import * as domUtils from '../utils/dom';
import fastApply from '../utils/fast-apply';

export default class ClientDomAdapter extends BaseDomAdapter {
    removeAttr (el, attr) {
        return nativeMethods.removeAttribute.call(el, attr);
    }

    getAttr (el, attr) {
        return nativeMethods.getAttribute.call(el, attr);
    }

    hasAttr (el, attr) {
        return el.hasAttribute(attr);
    }

    isSVGElement (el) {
        return domUtils.isSVGElement(el);
    }

    getClassName (el) {
        return el.className;
    }

    hasEventHandler (el) {
        var attrs = el.attributes;

        for (var i = 0; i < attrs.length; i++) {
            if (this.EVENTS.indexOf(attrs[i]))
                return true;
        }

        return false;
    }

    getTagName (el) {
        return domUtils.getTagName(el);
    }

    setAttr (el, attr, value) {
        return nativeMethods.setAttribute.call(el, attr, value);
    }

    setScriptContent (script, content) {
        script.text = content;
    }

    getScriptContent (script) {
        return script.text;
    }

    getStyleContent (style) {
        return style.innerHTML;
    }

    setStyleContent (style, content) {
        style.innerHTML = content;
    }

    getElementForSelectorCheck (el) {
        if (isIE9 && domUtils.isScriptElement(el)) {
            var clone = nativeMethods.cloneNode.call(el, false);

            clone.src = clone.innerHTML = '';

            return clone;
        }

        return el;
    }

    needToProcessUrl () {
        return true;
    }

    hasIframeParent (el) {
        try {
            return window.top.document !== domUtils.findDocument(el);
        }
        catch (e) {
            return true;
        }
    }

    attachEventEmitter (domProcessor) {
        var eventEmitter = new EventEmitter();

        domProcessor.on   = (evt, listener) => eventEmitter.on(evt, listener);
        domProcessor.off  = (evt, listener) => eventEmitter.off(evt, listener);
        domProcessor.emit = (...args) => fastApply(eventEmitter, 'emit', args);
    }

    getCrossDomainPort () {
        return settings.get().crossDomainProxyPort;
    }

    getProxyUrl () {
        return getProxyUrl.apply(null, arguments);
    }

    isTopParentIframe (el) {
        var elWindow = el[INTERNAL_PROPS.processedContext];

        return elWindow && window.top === elWindow.parent;
    }

    sameOriginCheck (location, checkedUrl) {
        return sameOriginCheck(location, checkedUrl);
    }
}
