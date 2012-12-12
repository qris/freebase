goog.provide('com.qwirx.test.FakeBrowserEvent');

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

com.qwirx.test.FakeBrowserEvent.send = function(type, target, opt_button)
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
	
	// patch a fake getParentEventTarget() method into the DOM elements
	// so that dispatchEvent works with them just like handleBrowserEvent().
	for (var parent = target; parent; parent = parent.getParentEventTarget())
	{
		parent.getParentEventTarget = com.qwirx.test.FakeBrowserEvent.fakeGetParentEventTarget;
	}
	
	var event;
	
	if (type instanceof goog.events.Event)
	{
		event = type;
	}
	else
	{
		event = new goog.events.BrowserEvent({
			type: type,
			button: opt_button || 0,
		});
	}
	
	goog.events.dispatchEvent(target, event);
};

com.qwirx.test.FakeBrowserEvent.mouseDown = function(target)
{
	com.qwirx.test.FakeBrowserEvent.send(goog.events.EventType.MOUSEDOWN,
		target);
};

com.qwirx.test.FakeBrowserEvent.mouseUp = function(target)
{
	com.qwirx.test.FakeBrowserEvent.send(goog.events.EventType.MOUSEUP,
		target);
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

