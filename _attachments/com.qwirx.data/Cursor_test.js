goog.provide('com.qwirx.data.Cursor_test');

goog.require('com.qwirx.data.Cursor');
goog.require('com.qwirx.data.SimpleDatasource');
goog.require('com.qwirx.test.assertThrows');
goog.require('com.qwirx.test.findDifferences');
goog.require('goog.testing.jsunit');

function getTestDataSource()
{
	var columns = [{name: 'id', caption: 'ID'},
		{name: 'name', caption: 'Name'}];
	var data = [
		[{value: 1}, {value: 'John'}],
		[{value: 2}, {value: 'James'}],
		[{value: 5}, {value: 'Peter'}],
	];
	return new com.qwirx.data.SimpleDatasource(columns, data);
}

function blockDiscards(cursor)
{
	function blockEvent(e)
	{
		return false;
	}

	// Install an event handler which blocks discards if the current
	// record is dirty. We don't modify the record, so it should not
	// become dirty during all these moves, and this handler should
	// never be called.
	cursor.addEventListener(com.qwirx.data.Cursor.Events.BEFORE_DISCARD,
		blockEvent);
}

function test_cursor_positioning()
{
	var ds = getTestDataSource();
	var c = new com.qwirx.data.Cursor(ds);
	assertEquals(com.qwirx.data.Cursor.BOF, c.getPosition());
	assertEquals(ds.getCount(), c.getRowCount());
	blockDiscards(c);

	com.qwirx.test.assertThrows(com.qwirx.data.IllegalMove,
		function() { c.moveRelative(-1); });

	assertTrue(c.moveRelative(0));
	assertEquals(com.qwirx.data.Cursor.BOF, c.getPosition());
	
	assertTrue(c.moveRelative(1));
	assertEquals(0, c.getPosition());

	assertTrue(c.moveRelative(0));
	assertEquals(0, c.getPosition());

	assertTrue(c.moveRelative(1));
	assertEquals(1, c.getPosition());

	assertTrue(c.moveRelative(-1));
	assertEquals(0, c.getPosition());

	assertTrue(c.moveRelative(2));
	assertEquals(2, c.getPosition());

	assertTrue(c.moveRelative(-3));
	assertEquals(com.qwirx.data.Cursor.BOF, c.getPosition());

	assertTrue(c.moveRelative(4));
	assertEquals(com.qwirx.data.Cursor.EOF, c.getPosition());

	com.qwirx.test.assertThrows(com.qwirx.data.IllegalMove,
		function() { c.moveRelative(1); });

	assertTrue(c.moveRelative(-1));
	assertEquals(2, c.getPosition());
	
	assertTrue(c.moveRelative(-1));
	assertEquals(1, c.getPosition());

	assertTrue(c.moveRelative(0));
	assertEquals(1, c.getPosition());

	assertTrue(c.moveRelative(-1));
	assertEquals(0, c.getPosition());

	assertTrue(c.moveRelative(-1));
	assertEquals(com.qwirx.data.Cursor.BOF, c.getPosition());
	
	// BOF is not a valid position. Check that setFieldValue throws
	// exception as expected
	com.qwirx.test.assertThrows(com.qwirx.data.NoCurrentRecord,
		function() { c.setFieldValue('foo', 'bar'); });
	com.qwirx.test.assertThrows(com.qwirx.data.NoCurrentRecord,
		function() { c.setFieldValue('foo', 'bar'); });
	com.qwirx.test.assertThrows(com.qwirx.data.NoCurrentRecord,
		function() { c.getLoadedValues().foo; });
	// Even if the field name is valid
	com.qwirx.test.assertThrows(com.qwirx.data.NoCurrentRecord,
		function() { c.setFieldValue('name', 'bar'); });

	c.setPosition(0);

	// There is no field called 'foo' in this cursor.
	com.qwirx.test.assertThrows(com.qwirx.data.NoSuchField,
		function() { c.setFieldValue('foo', 'bar'); });

	// But there is one called 'name'.		
	c.setFieldValue('name', 'whee'); // no exception
	
	// And setting it should cause the record to be dirty, which we
	// detect by blocking discard events and catching the exception.
	com.qwirx.test.assertThrows(com.qwirx.data.DiscardBlocked,
		function() { c.maybeDiscard(0); });

	// Check that relative and absolute movements also check
	// whether the record should be discarded, and throw the
	// exception if not.
	com.qwirx.test.assertThrows("setPosition should call maybeDiscard",
		com.qwirx.data.DiscardBlocked, function() { c.setPosition(0); });
	com.qwirx.test.assertThrows("moveRelative should call maybeDiscard",
		com.qwirx.data.DiscardBlocked, function() { c.moveRelative(1); });
	goog.asserts.assertInstanceof(exception, com.qwirx.data.DiscardBlocked);
	
	// Set it back to what it was, check that all functions work again
	c.setFieldValue('name', ds.get(0)['name']);
	c.maybeDiscard(0);
	c.setPosition(0);
	c.moveRelative(1);
	
	// Set it to a different value, and then reset it
	c.setFieldValue('name', 'whee');
	c.setFieldValue('name', c.getLoadedValues().name);
	
	// Check that it's not seen as dirty
	c.maybeDiscard(0);
	c.setPosition(0);
	c.moveRelative(1);
}

function test_cursor_new_record_creation()
{
	var ds = getTestDataSource();
	var c = new com.qwirx.data.Cursor(ds);
	blockDiscards(c);

	// Getting to NEW requires an explicit move
	var NEW = com.qwirx.data.Cursor.NEW;
	c.setPosition(NEW);
	assertEquals(NEW, c.getPosition());
	
	// All column values should be undefined here
	this.assertObjectEquals({}, c.getCurrentValues());
	this.assertObjectEquals({}, c.getLoadedValues());
	
	// We can set values too
	c.setFieldValue('id', 'foo');
	
	// The Cursor should know that the (new) record has been modified
	exception = assertThrows(function() { c.moveRelative(1); });
	goog.asserts.assertInstanceof(exception, com.qwirx.data.DiscardBlocked);

	// Set another field value
	c.setFieldValue('name', 'bar');
	
	// Try to save the record.
	// This record goes to the end of the datasource
	var numRecords = ds.getCount();
	c.save();
	assertEquals(numRecords + 1, ds.getCount());
	assertEquals(numRecords, c.getPosition());
	assertEquals('foo', c.getCurrentValues().id);
	assertEquals('bar', c.getCurrentValues().name);
}

