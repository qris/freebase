goog.provide('com.qwirx.data.Datasource');
goog.provide('com.qwirx.data.Datasource.Events');
goog.provide('com.qwirx.data.Datasource.RowEvent');
goog.provide('com.qwirx.data.SimpleDatasource');

goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('com.qwirx.util.Enum');

/**
 * @constructor
 * An exception thrown by {com.qwirx.data.Datasource.prototype.getRow}
 * if the requested row could not be retrieved because it definitely
 * does not exist in the datasource. For example, if you request a row
 * index less than zero, or more than the number of rows in the
 * data source.
 */
com.qwirx.data.NoSuchRecord = function(message)
{
	this.message = message;
};

/**
 * @constructor
 */
com.qwirx.data.Datasource = goog.nullFunction;

goog.inherits(com.qwirx.data.Datasource, goog.events.EventTarget);

com.qwirx.data.Datasource.Events = new com.qwirx.util.Enum(
	'ROW_COUNT_CHANGE', 'ROWS_INSERT', 'ROWS_UPDATE', 'ROWS_DELETE'
);

/**
 * A base class for events that affect specific rows of a
 * data source. The row indexes are passed as an array.
 * @constructor
 */ 
com.qwirx.data.Datasource.RowEvent = function(type, rowIndexes)
{
	goog.events.Event.call(this, type);
	this.rowIndexes_ = rowIndexes;
};

goog.inherits(com.qwirx.data.Datasource.RowEvent, goog.events.Event);

com.qwirx.data.Datasource.RowEvent.prototype.getAffectedRows =
	function()
{
	return this.rowIndexes_;
};

/**
 * Binary search on a sorted tree (actually any BaseNode) to find the
 * correct insertion point to maintain sort order.
 */
com.qwirx.data.Datasource.prototype.binarySearch =
	function(compareRowFn, target)
{
	var ds = this;
	
	return com.qwirx.util.Array.binarySearch(
		this.getCount(),
		function compareFn(atIndex)
		{
			return compareRowFn(target, ds.get(atIndex));
		});
};

/**
 * A simple data source for the grid component.
 * @param {Array.<string>} columns The names of the columns in this
 * data source. 
 * @param {Array.<Object>} data The initial contents of the data
 * source, which can be an empty array. Rows can be added using 
 *
 * @todo replace with {goog.ds.FastListNode}? Access by index is OK,
 * access by id could be fun, but the interface is not ideal for us:
 *
 * * What is our dataName, to pass to
 *   {goog.ds.FastDataNode.prototype.fromJs}?
 * * Where do we stash our columns?
 * * The {goog.ds.FastListNode.prototype.add} signature is not
 *   appropriate for inserting elements in the middle of the array.
 * * {goog.ds.FastListNode.prototype.setChildNode} requires
 *   inefficient parsing of strings like "[1]" to access elements by
 *   index instead of by name.
 *   We don't really want the inefficient "listen by path" mechanism
 *   for events, we just want an event whenever a record changes
 *   (for now).
 *
 * So for now I'll stick to using our own interface.
 * @constructor
 */

com.qwirx.data.SimpleDatasource = function(columns, data)
{
	this.columns_ = goog.array.clone(columns);
	this.data_ = goog.array.clone(data);
	for (var i = 0; i < this.data_.length; i++)
	{
		this.data_[i] = goog.object.clone(this.data_[i]);
	}
};

goog.inherits(com.qwirx.data.SimpleDatasource,
	com.qwirx.data.Datasource);

com.qwirx.data.SimpleDatasource.prototype.getColumns = function()
{
	return goog.array.clone(this.columns_);
};

com.qwirx.data.SimpleDatasource.prototype.getCount = function()
{
	return this.data_.length;
};

com.qwirx.data.SimpleDatasource.prototype.assertValidRow = 
	function(rowIndex, opt_maxIndex)
{
	if (rowIndex < 0)
	{
		throw new com.qwirx.data.NoSuchRecord('Impossible row ' +
			'index: ' + rowIndex);
	}

	if (opt_maxIndex == undefined)
	{
		opt_maxIndex = this.data_.length - 1;
	}

	if (rowIndex > opt_maxIndex)
	{
		throw new com.qwirx.data.NoSuchRecord('Row index ' + rowIndex +
			' is greater than allowed: ' + opt_maxIndex);
	}
};

com.qwirx.data.SimpleDatasource.prototype.get = function(rowIndex)
{
	this.assertValidRow(rowIndex);
	return goog.object.clone(this.data_[rowIndex]);
};

/**
 * Insert a new row (record) at the specified index of a simple
 * datasource. A {com.qwirx.data.Datasource.RowEvent} event will be
 * fired, with the type {com.qwirx.data.Datasource.Events.ROWS_INSERT},
 * and the {Array} [rowIndex] as the event data.
 *
 * @param {number} rowIndex The insert position.
 * {com.qwirx.data.SimpleDatasource.prototype.getRow}(rowIndex) will
 * return the data just inserted, and all subsequent rows will be
 * shifted down by one.
 *
 * @param {!Object} newRecord The values for the new record, which
 * may include or omit values for any columns in
 * {com.qwirx.data.SimpleDatasource.prototype.getColumns}.
 */
com.qwirx.data.SimpleDatasource.prototype.insert = 
	function(rowIndex, newRecord)
{
	this.assertValidRow(rowIndex, this.data_.length);
	this.data_.splice(rowIndex, 0, goog.object.clone(newRecord));
	this.dispatchEvent(new com.qwirx.data.Datasource.RowEvent(
		com.qwirx.data.Datasource.Events.ROWS_INSERT, [rowIndex]));
};

/**
 * Append a new row (record) to the end of a simple datasource.
 * A {com.qwirx.data.Datasource.RowEvent} event will be
 * fired, with the type {com.qwirx.data.Datasource.Events.ROWS_INSERT},
 * and an {Array}, consisting of just the new row index, as the event
 * data.
 *
 * @param {!Object} newRecord The values for the new record, which
 * may include or omit values for any columns in
 * {com.qwirx.data.SimpleDatasource.prototype.getColumns}.
 * @return the row index of the inserted record.
 */
com.qwirx.data.SimpleDatasource.prototype.add = function(newRecord)
{
	var pos = this.data_.length;
	this.insert(pos, newRecord);
	return pos;
};

/**
 * Replace the row (record) at the specified index of a simple
 * datasource with new data. A {com.qwirx.data.Datasource.RowEvent}
 * event will be fired, with the type
 * {com.qwirx.data.Datasource.Events.ROWS_UPDATE} and 
 * [rowIndex] as the event data.
 *
 * @param {number} rowIndex The row index to replace/overwrite.
 * {com.qwirx.data.SimpleDatasource.prototype.getRow}(rowIndex) will
 * return the data just inserted. Other rows will be unaffected.
 *
 * @param {!Object} newRecord The values for the new record, which
 * may include or omit values for any columns in
 * {com.qwirx.data.SimpleDatasource.prototype.getColumns}.
 */
com.qwirx.data.SimpleDatasource.prototype.replace = 
	function(rowIndex, newRecord)
{
	this.assertValidRow(rowIndex);
	this.data_.splice(rowIndex, 1, goog.object.clone(newRecord));
	this.dispatchEvent(new com.qwirx.data.Datasource.RowEvent(
		com.qwirx.data.Datasource.Events.ROWS_UPDATE, [rowIndex]));
};

/**
 * Remove the row (record) at the specified index of a simple
 * datasource. A {com.qwirx.data.Datasource.RowEvent}
 * event will be fired, with the type
 * {com.qwirx.data.Datasource.Events.ROWS_DELETE} and 
 * [rowIndex] as the event data.
 *
 * @param {number} rowIndex The row index to remove.
 * {com.qwirx.data.SimpleDatasource.prototype.getRow}(rowIndex) will
 * return the row that was previously at rowIndex + 1, and so on.
 *
 * @see goog.ds.FastDataNode.prototype.removeNode
 */
com.qwirx.data.SimpleDatasource.prototype.remove = function(rowIndex)
{
	this.assertValidRow(rowIndex);
	this.data_.splice(rowIndex, 1);
	this.dispatchEvent(new com.qwirx.data.Datasource.RowEvent(
		com.qwirx.data.Datasource.Events.ROWS_DELETE, [rowIndex]));
};


