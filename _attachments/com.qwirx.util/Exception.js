goog.provide('com.qwirx.util.Exception');

/**
 * @constructor
 * A base class for Freebase exceptions, that knows how to include
 * a stack trace on Chrome/V8.
 */
com.qwirx.util.Exception = function(message)
{
	Error.call(this, message);
	this.message = message;
	
	// https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
	if (!this['stack'] && Error['captureStackTrace'])
	{
		Error.captureStackTrace(this, com.qwirx.util.Exception);
	}
	
	if (!this['stack'])
	{
		// http://www.eriwen.com/javascript/js-stack-trace/
		this.stack = "";
		var currentFunction = arguments.callee.caller;
		while (currentFunction)
		{
			var fn = currentFunction.toString();
			var fname = fn.substring(fn.indexOf("function") + 8,
				fn.indexOf('')) || 'anonymous';
			stack += fname + "\n";
			currentFunction = currentFunction.caller;
		}
	}	
};
goog.inherits(com.qwirx.util.Exception, Error);

goog.provide('com.qwirx.util.ExceptionEvent');
goog.require('goog.events.Event');

/**
 * An {@link goog.events.Event} fired by a component when it would
 * otherwise throw an exception, but in response to a browser event
 * this is not appropriate because no parent component has the chance
 * to intercept and handle the exception.
 * <p>
 * For the moment, a component should always throw the ExceptionEvent
 * at itself, so you can identify the source of the error, the
 * component that threw the exception, from the event's
 * {@link goog.events.Event.prototype.target} property.
 *
 * @constructor
 * @param {Error} exception The exception that would have been thrown,
 *   preferably a subclass of {@link com.qwirx.util.Exception} which
 *   gives it a stack trace.
 * @param source The component that would have thrown the 
 *   exception. Since any component can handle events, the source
 *   could be of any type, even a function; however it would normally
 *   be a {@link goog.events.EventTarget}, so it can have events
 *   thrown at it, and it would often be the UI component that handles
 *   a browser event, such as a {@link goog.ui.Button}.
 */
com.qwirx.util.ExceptionEvent = function(exception, source)
{
	this.type = com.qwirx.util.ExceptionEvent.EVENT_TYPE;
	this.source = source;
	this.exception_ = exception;
}

goog.inherits(com.qwirx.util.ExceptionEvent, goog.events.Event);

com.qwirx.util.ExceptionEvent.EVENT_TYPE = 'com.qwirx.util.ExceptionEvent';

/**
 * @returns The component that would have thrown the 
 *   exception. Since any component can handle events, the source
 *   could be of any type, even a function; however it would normally
 *   be a {@link goog.events.EventTarget}, so it can have events
 *   thrown at it, and it would often be the UI component that handles
 *   a browser event, such as a {@link goog.ui.Button}. Currently this
 *   is expected to be the same as the event's
 *   {@link goog.events.Event.prototype.target} property, and hence
 *   is not used.
 */
com.qwirx.util.ExceptionEvent.prototype.getSource = function()
{
	return this.source;
}

com.qwirx.util.ExceptionEvent.prototype.getException = function()
{
	return this.exception_;
}

