goog.provide('com.qwirx.test.FakeBrowserEvent');

goog.require('goog.testing.events.Event');

/**
 * Fake getParentEventTarget() method patched into DOM elements so that
 * dispatchEvent() works on them.
 */
com.qwirx.test.FakeBrowserEvent.fakeGetParentEventTarget = function()
{
	if (this.getElement)
	{
		// looks like a goog.ui.Component
		return this.getElement().parentNode;
	}
	else
	{
		return this.parentNode;
	}
};

com.qwirx.test.FakeBrowserEvent.wrap = function(target, callback)
{
	if (target.getElement)
	{
		fail("You can't post browser events to Closure components. " +
			"Try .getElement()?");
	}

	if (!target.ownerDocument)
	{
		fail("You can only post browser events to DOM elements " +
			"that are in the DOM tree");
	}
	
	try
	{
		return callback(target);
	}
	catch (e)
	{
		throw new com.qwirx.test.FakeBrowserEvent.UnexpectedExceptionThrown(e);
	}
};

com.qwirx.test.FakeBrowserEvent.send = function(type, target, opt_button)
{
	com.qwirx.test.FakeBrowserEvent.wrap(target, function(new_target) {
		if (type instanceof goog.events.Event)
		{
			event = type;
		}
		else
		{
			event = new goog.testing.events.Event(type, new_target, opt_button);
		}
		
		return goog.testing.events.fireBrowserEvent(event);
	});
};
	
goog.require('com.qwirx.util.Exception');
com.qwirx.test.FakeBrowserEvent.UnexpectedExceptionThrown = function(exception)
{
	com.qwirx.util.Exception.call(this, "An exception was thrown " +
		"by a browser event handler, which is forbidden: " +
		exception.message);
	this.exception = exception;
	this.stack = exception.stack;
};
goog.inherits(com.qwirx.test.FakeBrowserEvent.UnexpectedExceptionThrown,
	com.qwirx.util.Exception);

/*
 * @returns a function's name.  If it has a (nonstandard) name
 * property, use it. Otherwise, convert the function to a string 
 * and extract the name from that. Returns an empty string for 
 * unnamed functions like itself.
 * @see "Closure, The Definitive Guide", chapter 9 section 4,
 * "Augmenting Classes."
 */
/*
com.qwirx.test.FakeBrowserEvent.UnexpectedExceptionThrown.prototype.getName =
	function(f)
{
	if (f.constructor.name)
	{
		return f.constructor.name;
	}
	
	var cons = f.constructor.toString();
	var m = cons.match(/function\s*([^(]*)\(/);
	if (m)
	{
		return m[1];
	}
	
	return "anonymous function";
};

*/

com.qwirx.test.FakeBrowserEvent.mouseDown = function(target, opt_button,
	opt_coords, opt_eventProperties)
{
	com.qwirx.test.FakeBrowserEvent.wrap(target, function(new_target) {
		goog.testing.events.fireMouseDownEvent(new_target, opt_button,
			opt_coords, opt_eventProperties);
	});

};

com.qwirx.test.FakeBrowserEvent.mouseUp = function(target, opt_button,
	opt_coords, opt_eventProperties)
{
	com.qwirx.test.FakeBrowserEvent.wrap(target, function(new_target) {
		goog.testing.events.fireMouseUpEvent(new_target, opt_button,
			opt_coords, opt_eventProperties);
	});
};

com.qwirx.test.FakeBrowserEvent.mouseMove = function(target)
{
	com.qwirx.test.FakeBrowserEvent.send(goog.events.EventType.MOUSEMOVE,
		target);
};

com.qwirx.test.FakeBrowserEvent.mouseOver = function(target)
{
	com.qwirx.test.FakeBrowserEvent.send(goog.events.EventType.MOUSEOVER,
		target);
};

com.qwirx.test.FakeBrowserEvent.mouseOut = function(target)
{
	com.qwirx.test.FakeBrowserEvent.send(goog.events.EventType.MOUSEOUT,
		target);
};

