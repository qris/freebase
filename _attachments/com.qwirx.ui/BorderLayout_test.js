goog.provide('com.qwirx.ui.BorderLayout_test');

goog.require('com.qwirx.util.Exception');
goog.require('com.qwirx.ui.BorderLayout');
goog.require('com.qwirx.test.assertThrows');
goog.require('com.qwirx.test.findDifferences');
goog.require('goog.testing.jsunit');

var domContainer = goog.dom.createDom(goog.dom.TagName.DIV,
	{'style': 'background-color: #eee; width: 50%; float: right;'});
goog.dom.appendChild(document.body, domContainer);

function setUp()
{
	goog.dom.removeChildren(domContainer);
}

function test_constructor()
{
	var bl = new com.qwirx.ui.BorderLayout();
	assertEquals(com.qwirx.ui.BorderLayout.Renderer.getInstance(),
		bl.renderer_);
	var slotNames = com.qwirx.ui.BorderLayout.Constraints;
	
	for (var i in slotNames)
	{
		assertObjectEquals([], bl.slots[slotNames[i]]);
	}		
}

function test_render()
{
	var bl = new com.qwirx.ui.BorderLayout();
	var children = goog.dom.getChildren(domContainer);
	assertObjectEquals([], Array.prototype.slice.call(children, 0));
	
	bl.render(domContainer);
	children = goog.dom.getChildren(domContainer);
	assertObjectEquals([bl.getElement()],
		Array.prototype.slice.call(children, 0));
}

function test_add_child_before_render()
{
	var bl = new com.qwirx.ui.BorderLayout();
	var child1 = new goog.ui.Control("<h1>Hello!</h1>");
	bl.addChild(child1, false);
	assertObjectEquals([child1], bl.slots['CENTER']);
	
	bl.render(domContainer);
	
	var children = goog.dom.getChildren(domContainer);
	assertObjectEquals([bl.getElement()],
		Array.prototype.slice.call(children, 0));
	
	children = goog.dom.getChildren(bl.getElement());
	assertObjectEquals([child1.getElement()],
		Array.prototype.slice.call(children, 0));
}

function test_add_child_after_render()
{
	var bl = new com.qwirx.ui.BorderLayout();
	bl.render(domContainer);
	
	var children = goog.dom.getChildren(domContainer);
	assertObjectEquals([bl.getElement()],
		Array.prototype.slice.call(children, 0));

	var child1 = new goog.ui.Control("<h1>Hello!</h1>");
	bl.addChild(child1, true);
	assertObjectEquals([child1], bl.slots['CENTER']);
	
	children = goog.dom.getChildren(bl.getElement());
	assertObjectEquals([child1.getElement()],
		Array.prototype.slice.call(children, 0));
}

function test_add_multiple_children_to_center_slot()
{
	var bl = new com.qwirx.ui.BorderLayout();

	var child1 = new goog.ui.Control("<h1>Hello!</h1>" /* CENTER */);
	bl.addChild(child1, true);
	assertObjectEquals([child1], bl.slots['CENTER']);

	var child2 = new goog.ui.Control("<h1>World!</h1>" /* CENTER */);
	var e = assertThrows(function()
		{
			bl.addChild(child2, true);
		});
	goog.asserts.assertInstanceof(e, com.qwirx.util.Exception,
		"The exception thrown was not an instance of com.qwirx.util.Exception"	);
	
	var e = assertThrows(function()
		{
			bl.addChild(child2, true, 'CENTER');
		});
	goog.asserts.assertInstanceof(e, com.qwirx.util.Exception,
		"The exception thrown was not an instance of com.qwirx.util.Exception"	);

	bl.addChild(child2, true, 'NORTH');
	assertObjectEquals([child2], bl.slots['NORTH']);
	assertObjectEquals([child1], bl.slots['CENTER']);
}

function test_add_child_twice()
{
	var bl = new com.qwirx.ui.BorderLayout();

	var child1 = new goog.ui.Control("<h1>Hello!</h1>");
	bl.addChild(child1, true);
	assertObjectEquals([child1], bl.slots['CENTER']);

	bl.addChild(child1, true, 'EAST');
	assertObjectEquals([], bl.slots['CENTER']);
	assertObjectEquals([child1], bl.slots['EAST']);
}

function test_add_children()
{
	var bl = new com.qwirx.ui.BorderLayout();

	var child1 = new goog.ui.Control("<h1>Hello!</h1>");
	bl.addChild(child1, true);
	assertObjectEquals([child1], bl.slots['CENTER']);

	var child2 = new goog.ui.Control("<h1>World!</h1>");
	bl.addChild(child2, true, 'SOUTH');
	assertObjectEquals([child1], bl.slots['CENTER']);
	assertObjectEquals([child2], bl.slots['SOUTH']);

	bl.render(domContainer);
	
	var children = goog.dom.getChildren(domContainer);
	assertObjectEquals([bl.getElement()],
		Array.prototype.slice.call(children, 0));
	
	children = goog.dom.getChildren(bl.getElement());
	assertObjectEquals([child1.getElement(), child2.getElement()],
		Array.prototype.slice.call(children, 0));
}

