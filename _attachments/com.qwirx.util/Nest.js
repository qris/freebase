goog.provide('com.qwirx.util.Nest');

/**
	@namespace
	@name com.qwirx.util.Nest
*/

/*
 * This is a utility class that helps to write procedural-style code
 * (in-order flow of control) to make understanding simpler when using
 * multiple nested callbacks. Simply construct the Nest with a
 * generic parameter object (which you control) and an array of little
 * functions (scriptlets).
 *
 * The scriptlets are called in sequence, being passed the parameter
 * and the Nest, on which you should call the function next() to proceed
 * to the next entry. If you return without calling next(), then the
 * iteration finishes.
 *
 * You can call next() inside any of your callbacks and return paths,
 * renaming it if necessary to avoid scope conflicts if you use nested
 * iterators.
 *
 * When you call a function that calls a callback, you could pass a
 * scriptlet as an argument, which calls i.next(). However, you can also
 * just pass i.callback, which does this for you, like this:
 *
 * <pre>
 * $(document).ready(new Nest({},
 *	function f1(p, i)
 *	{
 *		callJqueryFunctionThatNeedsACallback(args,
 *			// the long way around
 *			function callback(p, i2)
 *			{
 *				i2.next(); // executes f2
 *			});
 *	},
 *	function f2(p, i)
 *	{
 *		// the shortcut, which makes the callback call f3
 *		callJqueryFunctionThatNeedsACallback(args, i.callback);
 *	},
 *	function f3(p, i) { ... },
 *	// demo for passing an array instead of a callback, which calls
 *	// callJqueryFunctionThatNeedsACallback and then, from the callback, f4
 *	[callFunctionThatNeedsACallback, {}, Nest],
 *	function f3(p, i) { ... },
 * ));
 * </pre>
 *
 * If you pass an array instead of a scriptlet, as above, the first element
 * is the object (or null for a function), the second is the method or
 * function, and the remaining elements are its arguments. You should pass
 * Nest as one of the arguments, and it will be replaced by i.callback.
 * This is ideal for calling functions that take callbacks as arguments.
 *
 * Only one argument is formal, the rest (the scriptlets) are accessed through
 * the arguments variable.
 *
 * You can control which object becomes "this" during the callbacks to the
 * scriptlets (except array scriptlets), by calling a Nest object using the
 * call() builtin rather than just (). For example:
 *
 * <pre>
 * var n = Nest({}, function(p, i) { alert(this); });
 * n(); // alerts "null"
 * n.call(this); // alerts whatever this currently is
 * n.call("foo"); // alerts "foo"
 * </pre>
 *
 * This is possible because the Nest makes an effort to preserve "this"
 * when it calls your scriptlets.
 */
com.qwirx.util.Nest = function(param)
{
	var nest = this;
	nest.list = arguments;
	nest.lastIndex = 0; // skip the first argument

	// === next() ===
	// Call this function on the Nest passed to your scriptlet to
	// execute the next scriptlet.
	nest.next = function Nest_next()
	{
		var index = nest.lastIndex + 1;
		if (index >= nest.list.length)
		{
			return;
		}
		
		nest.lastIndex = index;
		var scriptlet = nest.list[index];
	
		if (goog.isArray(scriptlet))
		{
			// First element is the function, remaining ones are args, except
			// the one which uses Nest that we replace with i.next
		
			// There is no slice() method in the Arguments object, unfortunately
			var args = scriptlet.slice(2);
		
			for (var i = 1; i < args.length; i++)
			{
				if (args[i] == Nest)
				{
					args[i] = nest.callback;
				}
			}
		
			// "this" is set by the array, not by the invocation of Nest()().
			var object = scriptlet[0];
			var method = scriptlet[1];
		
			method.apply(object, args);
		}
		else
		{
			// "this" was set by the caller, so preserve it.
			scriptlet.call(this, param, nest);
		}
	};

	nest.callback = function Nest_callback()
	{
		// save the parameters passed to the callback
		param.callbackArgs = arguments;
		// invoke the next scriptlet
		nest.next();
	};
	
	// we don't want to execute immediately, but only when the Nest is called
	// as a function (e.g. a $.document.ready() callback)
	return function Nest_executor()
	{
		// call the first scriptlet, preserving "this", skipping the
		// param object
		nest.next.call(this);
	}
}

