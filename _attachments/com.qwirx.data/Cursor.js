/*
	@fileoverview Defines the {com.qwirx.data.Cursor} class, which
	wraps a {com.qwirx.data.Datasource} and a pointer to a specific,
	current record, like an Access Recordset.
*/

goog.provide('com.qwirx.data.Cursor');
goog.provide('com.qwirx.data.IllegalMove');
goog.provide('com.qwirx.data.FailedMove');

goog.require('com.qwirx.data.Datasource');
goog.require('com.qwirx.util.Enum');
goog.require('goog.events.EventTarget');

/**
	@class
		
	A Cursor wraps a com.qwirx.data.Datasource and a pointer to a
	specific, current record. It behaves a bit like an Access Recordset.
	
	You can move to the first, last, next or previous record, all
	of which fire events that you can listen for.
	
	It has a concept of a position (record number), which is just an
	index into the current (live) query results. The same record
	number may refer to	a different record if the data set changes
	under your feet (if you	want to return to the same record, use
	its ID). The position is always between 0 and the current row
	count ({#getRowCount}) minus one (unless the row count is unknown,
	when {#getRowCount} returns null), or one of the constants {#BOF},
	{#EOF} or {#NEW}. You can get the current position with
	{#getPosition} and set it directly with {#setPosition}.
	
	A Cursor provides access to the fields of the current record.
	Any changes to these field values in the Cursor will be lost if
	you navigate to a different record without calling the {#save}
	method. You can listen to the {#BEFORE_DISCARD} event to warn the
	user of this, and cancel the event if the user changes their mind,
	or the navigation was unintended.

	<p>BOF and EOF are never the same position, i.e. at least one
	{#moveForward} is required to move from BOF to EOF. This is because,
	at BOF, the Cursor has not attempted to retrieve a record,
	because you may not want to access the first record; and when you
	try, by calling {#moveForward}, it may discover that there are no
	records to retrieve. It would then place you at EOF, rather than
	throwing an exception, because this is a normal and not exceptional
	circumstance. Accessing any fields at BOF or EOF throws an
	exception.
	
	<p>The cursor position moves like this:
	
	<ul>
	<li>The cursor position always starts at BOF.
	<li>At BOF, {#movePrevious} throws an exception. Always check
	for BOF before calling movePrevious.
	<li>The first call to {#moveForward} sets the position to 0, if
	it finds at least one record in the dataset, otherwise EOF.
	<li>To iterate over all records you must call {#moveForward} at
	least once, and check whether {#isEOF} is then true.
	<li>At EOF, {#moveForward} throws an exception. Always check for
	EOF before calling moveForward.
	<li>{#moveFirst} moves the position to one after BOF. This
	will be EOF if the recordset is empty.</li>
	<li>{#moveLast} moves the position to one before EOF. This
	will be BOF if the recordset is empty.</li>
	</ul>
	
	For example:
	
	<pre>
	for (cursor.moveForward(); !cursor.isEOF(); cursor.moveForward())
	{ ... }
	</pre>

	@param {com.qwirx.data.Datasource} dataSource The data source
	which this Cursor should wrap.
	
	@param {com.qwirx.data.Datasource.AccessMode=} opt_accessMode
	You may get better performance from the	Cursor if you specify
	the type of access that you intend to perform on it, which it
	can use as a hint to prefetch an appropriate number of records.
*/
com.qwirx.data.Cursor = function(dataSource, opt_accessMode)
{
	this.dataSource_ = dataSource;
	this.position_ = com.qwirx.data.Cursor.BOF;
};
goog.inherits(com.qwirx.data.Cursor, goog.events.EventTarget);

com.qwirx.data.Cursor.AccessMode = new com.qwirx.util.Enum(
	'ALL_SEQUENTIAL', 'LINEAR_SEARCH', 'BINARY_SEARCH', 'RANDOM'
);

/**
	The initial recordset pointer, meaning "before the first record"
	or "no records have been retrieved yet".
	@const
*/
com.qwirx.data.Cursor.BOF = "BOF";

/**
	A recordset pointer meaning "after the last record", or
	"I tried to retrieve another record for you, and the Datasource
	told me that there were no more."
	@const
*/
com.qwirx.data.Cursor.EOF = "EOF";

/**
	A recordset pointer meaning "a new or unsaved record", or
	"This is the new record that I am building in memory for you."
	@const
*/
com.qwirx.data.Cursor.NEW = "NEW";

com.qwirx.data.Cursor.Events = new com.qwirx.util.Enum(
	'MOVE_FIRST', 'MOVE_BACKWARD', 'MOVE_FORWARD', 'MOVE_LAST',
	'MOVE_TO', 'CREATE_NEW', 'DELETE_CURRENT_ROW',
	'BEFORE_DISCARD', 'DISCARD'
);

/**
 * @return the number of rows in the underlying data source, or null
 * if the number is currently unknown.
 */
com.qwirx.data.Cursor.prototype.getRowCount = function()
{
	return this.dataSource_.getCount();
};

/**
 * @return the current position, which is an integer between 0 and
 * {#getRowCount}() - 1, unless the row count is unknown (null), in
 * which case there is no upper bound; or one of the constants
 * {#BOF}, {#EOF} or {#NEW}.
 */
com.qwirx.data.Cursor.prototype.getPosition = function()
{
	return this.position_;
};

/**
 * @param newPosition the new position, which is an integer between
 * 0 and {#getRowCount}() - 1, unless the row count is unknown (null),
 * in which case there is no upper bound; or one of the constants
 * {#BOF}, {#EOF} or {#NEW}. Setting the position to any other value
 * will throw an exception.
 *
 * This method calls {com.qwirx.data.Cursor.prototype.maybeDiscard}
 * before changing the position, which will throw an exception if
 * the current record is dirty and an event handler blocks the
 * {com.qwirx.data.Cursor.Events.BEFORE_DISCARD} event. This cancels
 * the change in position.
 *
 * The new record may not be retrieved immediately, depending on who's
 * listening to this Cursor; so if the record count
 * is currently unknown, then it's possible to set the position to an
 * invalid value. Actually retrieving the record (e.g. lazily, by
 * accessing its field values) may throw an exception if the position
 * was set to an invalid value. In this case, you may wish to handle
 * the exception by resetting the position to {#EOF}.
 *
 * @throws {com.qwirx.data.Cursor.Events.BEFORE_DISCARD} if
 * {com.qwirx.data.Cursor.prototype.maybeDiscard} does.
 */
com.qwirx.data.Cursor.prototype.setPosition = function(newPosition)
{
	this.maybeDiscard();

	var rowCount = this.getRowCount();
	
	if (newPosition == com.qwirx.data.Cursor.BOF ||
		newPosition == com.qwirx.data.Cursor.EOF ||
		newPosition == com.qwirx.data.Cursor.NEW ||
		(newPosition >= 0 &&
		(rowCount == null || newPosition < rowCount)))
	{
		this.position_ = newPosition;
	}
	else
	{
		throw new com.qwirx.data.IllegalMove("Invalid position: " +
			newPosition);
	}

	if (newPosition == com.qwirx.data.Cursor.BOF ||
		newPosition == com.qwirx.data.Cursor.EOF)
	{
		this.currentRecordValues_ = null;
		this.currentRecordAsLoaded_ = null;
	}
	else if (newPosition == com.qwirx.data.Cursor.NEW)
	{
		this.currentRecordValues_ = {};
		this.currentRecordAsLoaded_ = {};
	}
	else
	{
		this.currentRecordValues_ = {};
		this.currentRecordAsLoaded_ = {};
		var columns = this.dataSource_.getColumns();
		var record;
		
		if (newPosition == com.qwirx.data.Cursor.NEW)
		{
			record = {};
		}
		else
		{
			record = this.dataSource_.get(this.position_);
		}
	
		for (var i = 0; i < columns.length; i++)
		{
			this.currentRecordValues_[columns[i].name] =
				this.currentRecordAsLoaded_[columns[i].name] =
				record[columns[i].name];
		}
	}
	
	this.dispatchEvent({
		type: com.qwirx.data.Cursor.Events.MOVE_TO,
		newPosition: newPosition
		});
};

/**
 * @return the column definitions from the underlying data source.
 */
com.qwirx.data.Cursor.prototype.getColumns = function()
{
	return this.dataSource_.getColumns().slice(0); // copy
};

/**
 * @return true if the current position is at EOF, i.e. any attempt
 * to access data or move to the next record will throw an exception.
 */
com.qwirx.data.Cursor.prototype.isEOF = function()
{
	return this.position_ == com.qwirx.data.Cursor.EOF;
};

/**
 * @return true if the field values have been changed (the current
 * record is dirty).
 */
com.qwirx.data.Cursor.prototype.isDirty = function()
{
	var newValues = this.currentRecordValues_;
	var oldValues = this.currentRecordAsLoaded_;
	
	if (newValues == null)
	{
		// no record has been loaded, so it can't be dirty
		return false;
	}
	
	for (var prop in newValues)
	{
		if (!newValues.hasOwnProperty(prop)) continue;
		if (!oldValues.hasOwnProperty(prop)) return true;
		if (oldValues[prop] != newValues[prop]) return true;
	}
	
	for (var prop in oldValues)
	{
		if (!oldValues.hasOwnProperty(prop)) continue;
		if (!newValues.hasOwnProperty(prop)) return true;
		// if the property is in both, then it's already been compared
	}
	
	return false;
};

/**
 * If the field values have not been changed (the current record is
 * not dirty) then this function does nothing.
 *
 * Otherwise it fires a {com.qwirx.data.Cursor.Events.BEFORE_DISCARD}
 * event. If that event is not cancelled, a
 * {com.qwirx.data.Cursor.Events.DISCARD} event is fired, which cannot
 * be cancelled. The current record values are reset to their original
 * values when the current record was loaded. The database is not
 * requeried in case the record has changed, unless you explicitly
 * call {#reload} (in which case you don't need to call this function,
 * because {#reload} can do it for you).
 *
 * @throws {com.qwirx.data.DiscardBlocked} if a BEFORE_DISCARD event
 * was sent and cancelled by an event listener.
 */
com.qwirx.data.Cursor.prototype.maybeDiscard = function()
{
	if (!this.isDirty())
	{
		return;
	}
	
	var cancelled = !this.dispatchEvent({
		type: com.qwirx.data.Cursor.Events.BEFORE_DISCARD
		});
	
	if (cancelled)
	{
		throw new com.qwirx.data.DiscardBlocked("The cursor points " +
			"to modified data, and the BEFORE_DISCARD event was " +
			"cancelled, so the cursor cannot be moved.");
	}
	
	this.currentRecordValues_ = this.currentRecordAsLoaded_;
};

/**
 * Move forward (if numRowsToMove > 0) or backward (if 
 * numRowsToMove < 0) or not at all (if numRowsToMove == 0).
 *
 * Calls {#maybeDiscard} to check whether modified field values
 * should be discarded, and if that throws an exception, the move is
 * cancelled and moveRelative propagates the exception.
 *
 * Otherwise a {#MOVE_FORWARD} and a {#MOVE_TO} event are fired.
 * 
 * If the data source has an unknown number of rows, we may move to
 * a record position that doesn't exist. This may result in an
 * exception being thrown when you try to access the current row's data. 
 * You may wish to respond to that exception by setting the current
 * position to {#EOF} at the time.
 *
 * @throws {com.qwirx.data.IllegalMove} if we're already at {#EOF}.
 * @return true if the move succeeded, false otherwise.
 */
com.qwirx.data.Cursor.prototype.moveRelative = function(numRowsToMove)
{
	this.maybeDiscard();

	var newPosition = this.position_;
	var rowCount = this.getRowCount();

	if (numRowsToMove == 0)
	{
		// no change
	}
	else if (this.position_ == com.qwirx.data.Cursor.BOF)
	{
		if (numRowsToMove < 0)
		{
			throw new com.qwirx.data.IllegalMove("Currently at BOF; " +
				"there is no previous record");
		}
		else // numRowsToMove > 0
		{
			newPosition = numRowsToMove - 1;
		}
	}
	else if (this.position_ == com.qwirx.data.Cursor.EOF ||
		this.position_ == com.qwirx.data.Cursor.NEW)
	{
		if (numRowsToMove > 0)
		{
			throw new com.qwirx.data.IllegalMove("Currently at EOF; " +
				"there is no next record");
		}
		else if (rowCount == null)
		{
			throw new com.qwirx.data.IllegalMove("Currently at EOF " +
				"and row count is unknown; cannot calculate the " +
				"new position; use moveFirst() instead");
		}
		else
		{
			newPosition = rowCount + numRowsToMove;
		}
	}
	else
	{
		newPosition += numRowsToMove;
	}
	
	if (newPosition == com.qwirx.data.Cursor.BOF ||
		newPosition == com.qwirx.data.Cursor.EOF ||
		newPosition == com.qwirx.data.Cursor.NEW)
	{
		// no adjustment necessary or possible
	}
	else if (newPosition < 0)
	{
		newPosition = com.qwirx.data.Cursor.BOF;
	}
	else if (rowCount != null && newPosition >= rowCount)
	{
		newPosition = com.qwirx.data.Cursor.EOF;
	}

	this.dispatchEvent({
		type: com.qwirx.data.Cursor.Events.MOVE_FORWARD,
		numRows: numRowsToMove,
		newPosition: newPosition
		});

	this.setPosition(newPosition);
	return true;
};

/**
 * Move to the first row. If the number of rows is known and zero,
 * this moves to EOF, otherwise to row 0.
 */
com.qwirx.data.Cursor.prototype.moveFirst = function()
{
	var rowCount = this.getRowCount();
	var newPosition = 0;
	
	if (rowCount != null && rowCount == 0)
	{
		newPosition = com.qwirx.data.Cursor.EOF;
	}

	this.dispatchEvent({
		type: com.qwirx.data.Cursor.Events.MOVE_FIRST,
		newPosition: newPosition
		});

	this.setPosition(newPosition);
};

/**
 * Move to the last row. Illegal if the number of rows is unknown.
 */
com.qwirx.data.Cursor.prototype.moveLast = function()
{
	var rowCount = this.getRowCount();
	if (rowCount == null)
	{
		throw new com.qwirx.data.IllegalMove("Cannot move to end " +
			"with an unknown number of rows");
	}
	
	var newPosition = rowCount - 1;

	this.dispatchEvent({
		type: com.qwirx.data.Cursor.Events.MOVE_LAST,
		newPosition: newPosition
		});

	this.setPosition(newPosition);
};

/**
 * @constructor
 * An exception thrown by {com.qwirx.data.Cursor.prototype.setFieldValue}
 * if there is no current record, because the cursor is positioned at
 * {com.qwirx.data.Cursor.BOF} or {com.qwirx.data.Cursor.EOF}.
 */
com.qwirx.data.NoCurrentRecord = function(message)
{
	this.message = message;
};

/**
 * @constructor
 * An exception thrown by {com.qwirx.data.Cursor.prototype.setFieldValue}
 * if the specified field name is not a valid field/column for this
 * cursor.
 */
com.qwirx.data.NoSuchField = function(message)
{
	this.message = message;
};

com.qwirx.data.Cursor.prototype.assertCurrentRecord = function()
{
	if (this.position_ == com.qwirx.data.Cursor.BOF ||
		this.position_ == com.qwirx.data.Cursor.EOF)
	{
		throw new com.qwirx.data.NoCurrentRecord("The cursor " +
			"is at " + this.position_ + " which is not a valid " +
			"record, so the field values cannot be modified.");
	}
};

com.qwirx.data.Cursor.prototype.assertValidField = function(fieldName)
{
	var columns = this.dataSource_.getColumns();
	var fieldNames = [];
	
	for (var i = 0; i < columns.length; i++)
	{
		if (columns[i].name == fieldName)
		{
			return;
		}
		
		fieldNames.push(columns[i].name);
	}
	
	throw new com.qwirx.data.NoSuchField("The field " + fieldName +
		" does not exist in this cursor. Valid fields are: " +
		fieldNames.join(" "));
};

/**
 * Sets the value of a field of the current record.
 * @param {String} fieldName the name of the field to modify
 * @param newValue the new value of the field, which can be of any
 * type.
 * @throws {com.qwirx.data.NoCurrentRecord} if the cursor is at
 * {com.qwirx.data.Cursor.BOF} or {com.qwirx.data.Cursor.EOF}.
 * @throws {com.qwirx.data.NoSuchField} if the supplied field name
 * does not exist in the current record.
 */
com.qwirx.data.Cursor.prototype.setFieldValue = function(fieldName,
	newValue)
{
	this.assertCurrentRecord();
	this.assertValidField(fieldName);
	this.currentRecordValues_[fieldName] = newValue;
};

/**
 * @constructor
 * A generic exception superclass for illegal or blocked cursor
 * movement attempts.
 */
com.qwirx.data.CursorMovementException = function(message)
{
	com.qwirx.util.Exception.call(this, message);
};
goog.require('com.qwirx.util.Exception');
goog.inherits(com.qwirx.data.CursorMovementException,
	com.qwirx.util.Exception);

/**
 * @constructor
 * An exception response to an illegal movement attempt,
 * such as moving to the previous record from BOF or the next record
 * from EOF, which is never allowed and should not be offered to the
 * user.
 */
com.qwirx.data.IllegalMove = function(message)
{
	com.qwirx.data.CursorMovementException.call(this, message);
};
goog.inherits(com.qwirx.data.IllegalMove,
	com.qwirx.data.CursorMovementException);

/**
 * @constructor
 * An exception response to a movement attempt which is blocked by
 * a {com.qwirx.data.Cursor.Events.BEFORE_DISCARD} event handler
 * cancelling the event, perhaps because the user has unsaved changes
 * that they wish not to discard yet.
 */
com.qwirx.data.DiscardBlocked = function(message)
{
	com.qwirx.data.CursorMovementException.call(this, message);
};
goog.inherits(com.qwirx.data.DiscardBlocked,
	com.qwirx.data.CursorMovementException);

/**
 * @return the value of the named field when this record was loaded,
 * as opposed to its current value.
 * @throws {com.qwirx.data.NoCurrentRecord} if the cursor is at
 * {com.qwirx.data.Cursor.BOF} or {com.qwirx.data.Cursor.EOF}.
 */
com.qwirx.data.Cursor.prototype.getLoadedValues = function(fieldName,
	newValue)
{
	this.assertCurrentRecord();
	return goog.object.clone(this.currentRecordAsLoaded_);
};

/**
 * @return the current, possibly unsaved values of all fields in the
 * current record.
 * @throws {com.qwirx.data.NoCurrentRecord} if the cursor is at
 * {com.qwirx.data.Cursor.BOF} or {com.qwirx.data.Cursor.EOF}.
 */
com.qwirx.data.Cursor.prototype.getCurrentValues = function(fieldName,
	newValue)
{
	this.assertCurrentRecord();
	return goog.object.clone(this.currentRecordValues_);
};

/**
 * Write the current record to the {com.qwirx.data.Datasource}. This
 * only makes sense when the cursor is positioned on a current record
 * or at {com.qwirx.data.Cursor.NEW}.
 * @throws {com.qwirx.data.NoCurrentRecord} if the cursor is at
 * {com.qwirx.data.Cursor.BOF} or {com.qwirx.data.Cursor.EOF}.
 */
com.qwirx.data.Cursor.prototype.save = function()
{
	this.assertCurrentRecord();
	if (this.position_ == com.qwirx.data.Cursor.NEW)
	{
		this.position_ = 
			this.dataSource_.add(this.currentRecordValues_);
	}
	else
	{
		this.dataSource_.putRecord(this.position_,
			this.currentRecordValues_);
	}
	return this.position_;
};

