goog.provide('com.qwirx.data.Datasource');
goog.provide('com.qwirx.data.Datasource.Events');
goog.provide('com.qwirx.data.Datasource.RowEvent');
goog.provide('com.qwirx.data.SimpleDatasource');

goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('com.qwirx.util.Enum');

/**
 * @constructor
 */
com.qwirx.data.Datasource = goog.nullFunction;

goog.inherits(com.qwirx.data.Datasource, goog.events.EventTarget);

com.qwirx.data.Datasource.Events = new com.qwirx.util.Enum(
	'ROW_COUNT_CHANGE', 'ROWS_INSERT', 'ROWS_UPDATE'
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
		this.getRowCount(),
		function compareFn(atIndex)
		{
			return compareRowFn(target, ds.getRow(atIndex));
		});
};

/**
 * A simple data source for the grid component.
 * @todo replace with goog.ds.DataNode.
 * @constructor
 */

com.qwirx.data.SimpleDatasource = function(columns, data)
{
	this.columns_ = goog.array.clone(columns);
	this.data_ = goog.array.clone(data);
};

goog.inherits(com.qwirx.data.SimpleDatasource,
	com.qwirx.data.Datasource);

com.qwirx.data.SimpleDatasource.prototype.getColumns = function()
{
	return this.columns_;
};

com.qwirx.data.SimpleDatasource.prototype.getRowCount = function()
{
	return this.data_.length;
};

com.qwirx.data.SimpleDatasource.prototype.getRow = function(rowIndex)
{
	return this.data_[rowIndex];
};

com.qwirx.data.SimpleDatasource.prototype.insertRow = 
	function(rowIndex, newRowData)
{
	this.data_.splice(rowIndex, 0, newRowData);
	this.dispatchEvent(new com.qwirx.data.Datasource.RowEvent(
		com.qwirx.data.Datasource.Events.ROWS_INSERT, [rowIndex]));
};

com.qwirx.data.SimpleDatasource.prototype.appendRow = 
	function(newRowData)
{
	this.insertRow(this.data_.length, newRowData);
};

com.qwirx.data.SimpleDatasource.prototype.updateRow = 
	function(rowIndex, newRowData)
{
	this.data_.splice(rowIndex, 1, newRowData);
	this.dispatchEvent(new com.qwirx.data.Datasource.RowEvent(
		com.qwirx.data.Datasource.Events.ROWS_UPDATE, [rowIndex]));
};

