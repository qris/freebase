goog.provide('com.qwirx.data.Datasource_test');

goog.require('com.qwirx.data.Datasource');
goog.require('com.qwirx.data.SimpleDatasource');
goog.require('com.qwirx.test.assertThrows');
goog.require('goog.testing.jsunit');

function getTestDataSource()
{
	var columns = [{name: 'id', caption: 'ID'},
		{name: 'name', caption: 'Name'}];
	var data = [
		{id: 1, name: 'John'},
		{id: 2, name: 'James'},
		{id: 5, name: 'Peter'},
	];
	return new com.qwirx.data.SimpleDatasource(columns, data);
}

function test_construct_simple_datasource()
{
	var ds = getTestDataSource();
	assertObjectEquals([{name: 'id', caption: 'ID'},
		{name: 'name', caption: 'Name'}], ds.getColumns());
	assertEquals(3, ds.getCount());
	assertObjectEquals({id: 1, name: 'John'}, ds.get(0));
	assertObjectEquals({id: 2, name: 'James'}, ds.get(1));
	assertObjectEquals({id: 5, name: 'Peter'}, ds.get(2));
	com.qwirx.test.assertThrows("Wrong kind of exception for access " +
		"out of bounds", com.qwirx.data.NoSuchRecord,
		function(){ds.get(-1);});
	com.qwirx.test.assertThrows("Wrong kind of exception for access " +
		"out of bounds", com.qwirx.data.NoSuchRecord,
		function(){ds.get(3);});
}

function test_simple_datasource_add()
{
	var ds = getTestDataSource();
	var n = {id: "hello" /* name attribute is missing */};
	assertEquals(3, ds.getCount());
	ds.add(n);
	assertEquals(4, ds.getCount());
	assertObjectEquals(n, ds.get(3));
	n.name = "world";
	assertUndefined("changes to objects should not affect added data",
		ds.get(3).name);
}

function test_simple_datasource_insert()
{
	var ds = getTestDataSource();
	var n = {id: "hello", name: "world", extra: "whee"};
	assertEquals(3, ds.getCount());
	ds.insert(1, n);
	assertEquals(4, ds.getCount());
	assertObjectEquals({id: 1, name: 'John'}, ds.get(0));
	assertObjectEquals(n, ds.get(1));
	assertObjectEquals({id: 2, name: 'James'}, ds.get(2));
	n.name = "cruel";
	assertEquals("changes to objects should not affect inserted data",
		"world", ds.get(1).name);
	com.qwirx.test.assertThrows("Wrong kind of exception for access " +
		"out of bounds", com.qwirx.data.NoSuchRecord,
		function(){ds.insert(-1, n);});
	com.qwirx.test.assertThrows("Wrong kind of exception for access " +
		"out of bounds", com.qwirx.data.NoSuchRecord,
		function(){ds.insert(5, n);});

	ds.insert(4, n);
	assertEquals(5, ds.getCount());
	assertObjectEquals(n, ds.get(4));

	ds.insert(0, n);
	assertEquals(6, ds.getCount());
	assertObjectEquals(n, ds.get(0));
}

function test_simple_datasource_replace()
{
	var ds = getTestDataSource();
	var n = {id: "hello", name: "world", extra: "whee"};
	assertEquals(3, ds.getCount());
	ds.replace(1, n);
	assertEquals("replace should not change size of data source",
		3, ds.getCount());
	assertObjectEquals({id: 1, name: 'John'}, ds.get(0));
	assertObjectEquals(n, ds.get(1));
	assertObjectEquals({id: 5, name: 'Peter'}, ds.get(2));
	n.name = "cruel";
	assertEquals("changes to objects should not affect inserted data",
		"world", ds.get(1).name);
	com.qwirx.test.assertThrows("Wrong kind of exception for access " +
		"out of bounds", com.qwirx.data.NoSuchRecord,
		function(){ds.replace(-1, n);});
	com.qwirx.test.assertThrows("Wrong kind of exception for access " +
		"out of bounds", com.qwirx.data.NoSuchRecord,
		function(){ds.replace(3, n);});
}

function test_simple_datasource_remove()
{
	var ds = getTestDataSource();
	assertEquals(3, ds.getCount());
	ds.remove(1);
	assertEquals("remove should reduce size of data source",
		2, ds.getCount());
	assertObjectEquals({id: 1, name: 'John'}, ds.get(0));
	assertObjectEquals({id: 5, name: 'Peter'}, ds.get(1));
	com.qwirx.test.assertThrows("Wrong kind of exception for access " +
		"out of bounds", com.qwirx.data.NoSuchRecord,
		function(){ds.remove(-1);});
	com.qwirx.test.assertThrows("Wrong kind of exception for access " +
		"out of bounds", com.qwirx.data.NoSuchRecord,
		function(){ds.remove(2);});
}

