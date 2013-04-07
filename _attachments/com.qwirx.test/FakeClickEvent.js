goog.provide('com.qwirx.test.FakeClickEvent');
goog.require('com.qwirx.test.FakeBrowserEvent');
goog.require('goog.events.BrowserEvent');

/**
 * {goog.events.BrowserEvent#isMouseActionButton}'s behaviour
 * depends on the browser. I don't want to reverse engineer and
 * simulate all possible browser behaviours, so I'll just override
 * it to pretend that I did that for your browser and deduced that
 * the answer is "yes it is a mouse action event."
 * 
 * @param type {string} The type of event, e.g.
 * {goog.events.EventType.MOUSEDOWN}.
 * @param target {Element} The target DOM element that caused the
 * event, or with which it is associated. Apparently this is not
 * optional!
 */
com.qwirx.test.FakeClickEvent = function(type, target)
{
	/**
	 * {goog.events.BrowserEvent} constructor only takes an event
	 * object, not a type, so if we got a type then we construct a
	 * fake event object here to pass to it.
	 */
	var fakeBrowserEvent = {
		type: type,
		target: target
	};
	com.qwirx.test.FakeClickEvent.superClass_.constructor.call(this,
		fakeBrowserEvent);
};

goog.inherits(com.qwirx.test.FakeClickEvent, goog.events.BrowserEvent);

com.qwirx.test.FakeClickEvent.prototype.isMouseActionButton =
	function()
{
	return true;
};

com.qwirx.test.FakeClickEvent.prototype.isMouseActionButton =
	function()
{
	return true;
};

/**
 * Unlike most {com.qwirx.test} events, a "click" is actually a
 * {goog.ui.Component.EventType.ACTION} event, which is fired
 * at the <b>control</b> (not the DOM element) by
 * {goog.ui.Control.prototype.performActionInternal}.
 * in response to various events that it listens to, such as
 * {goog.events.EventType.MOUSEUP} and
 * {goog.events.KeyHandler.EventType.KEY}.
 *
 * In order to ensure that this behaves like a <b>real</b> click,
 * which is ignored by disabled controls or controls whose
 * events are intercepted by a parent, we actually send 
 * {goog.events.EventType.MOUSEDOWN} and
 * {goog.events.EventType.MOUSEUP} to the control to simulate
 * a click, which makes it {goog.ui.Control.prototype.isActive active}
 * in the process.
 *
 * We could just call {goog.ui.Control.prototype.performActionInternal},
 * but that's an implementation detail of {goog.ui.Control}.
 *
 * @param target the {goog.ui.Control} or the DOM element to fire the
 * events on. We can check that the control flips its Active status
 * from false to true and back again, but only if you pass the
 * goog.ui.Control instead of the DOM element.
 */
com.qwirx.test.FakeClickEvent.send = function(target)
{
	var control, element;
	
	if (target instanceof goog.ui.Control)
	{
		control = target;
		element = target.getElement();
	}
	else
	{
		control = null;
		element = target;
	}
	
	if (control)
	{
		assertFalse("control should be inactive before MOUSEDOWN",
			control.isActive());
	}
	
	com.qwirx.test.FakeBrowserEvent.mouseDown(element);

	if (control)
	{
		assertTrue("control should be active after MOUSEDOWN",
			control.isActive());
	}

	com.qwirx.test.FakeBrowserEvent.mouseUp(element);

	if (control)
	{
		assertFalse("control should be inactive after MOUSEUP",
			control.isActive());
	}
};
