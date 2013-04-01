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

