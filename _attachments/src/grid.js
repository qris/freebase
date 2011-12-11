goog.provide('com.qwirx.freebase.Grid');

goog.require('goog.ui.Control');
goog.require('goog.editor.SeamlessField');

var
  /** @define {boolean} */ DEBUG = true;
 
com.qwirx.freebase.log = function(var_args)
{
	if (DEBUG)
	{
		console.log.apply(console, arguments);
	}
};

com.qwirx.freebase.Grid = function(columns, opt_renderer)
{
	opt_renderer = opt_renderer || com.qwirx.freebase.Grid.RENDERER;
	goog.ui.Control.call(this, null, opt_renderer);
	this.columns_ = columns.slice(0); // copy
	
	// focusing a grid isn't very useful and looks ugly in Chrome
	this.setSupportedState(goog.ui.Component.State.FOCUSED, false);
	
	this.drag = { origin: undefined, x1: -1, y1: -1, x2: -1, y2: -1 };
	
};

goog.inherits(com.qwirx.freebase.Grid, goog.ui.Control);

/*
com.qwirx.freebase.Grid.prototype.enableMouseEventHandling_ = function(enable)
{
	com.qwirx.freebase.Grid.superClass_.enableMouseEventHandling_.call(this, enable);

	var handler = this.getHandler();
	var element = this.getElement();
	if (enable)
	{
		handler.listen(element, goog.events.EventType.MOUSEMOVE,
			this.handleMouseMove);
	}
	else
	{
		handler.unlisten(element, goog.events.EventType.MOUSEMOVE,
			this.handleMouseMove);
	}
};
*/

com.qwirx.freebase.Grid.RENDERER = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-grid');

com.qwirx.freebase.Grid.prototype.createDom = function()
{
	this.element_ = this.dom_.createDom('table',
		this.getRenderer().getClassNames(this).join(' '));
	this.element_.id = goog.string.createUniqueString();

	var columns = this.columns_;
	var numCols = columns.length;
	var colHeadingCells = [];
	
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var th = column.tableCell = this.dom_.createDom('th', {},
			column.caption);
		colHeadingCells.push(th);
	}
	
	var headingRow = this.headingRow_ = this.dom_.createDom('tr', {},
		colHeadingCells);
	this.element_.appendChild(headingRow);
	
	this.rowCount_ = 0;
	this.rows_ = [];
	this.rowElements_ = [];
	this.highlightStyles_ = goog.style.installStyles('', this.element_);
};

com.qwirx.freebase.Grid.TD_ATTRIBUTE_ROW = 
	com.qwirx.freebase.Freebase.FREEBASE_FIELD_PREFIX + 'grid_row';
com.qwirx.freebase.Grid.TD_ATTRIBUTE_COL = 
	com.qwirx.freebase.Freebase.FREEBASE_FIELD_PREFIX + 'grid_col';

com.qwirx.freebase.Grid.prototype.insertRowAt = function(columns, newRowIndex)
{
	var numCols = columns.length;
	var cells = [];
	
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var cssClasses = 'col_' + i;
		var td = column.tableCell = this.dom_.createDom('td', cssClasses,
			column.value);
		td[com.qwirx.freebase.Grid.TD_ATTRIBUTE_COL] = i;
		td[com.qwirx.freebase.Grid.TD_ATTRIBUTE_ROW] = newRowIndex;
			
		cells.push(td);
	}
	
	var newTableRow = this.dom_.createDom('tr', {}, cells);
	goog.dom.insertChildAt(this.element_, newTableRow,
		newRowIndex + 1 /* for header row */);
	
	this.rowCount_++;
	this.rows_.splice(newRowIndex, 0, columns);
	this.rowElements_.splice(newRowIndex, 0, newTableRow);
};

com.qwirx.freebase.Grid.prototype.appendRow = function(columns)
{
	var newRowIndex = this.rowCount_;
	this.insertRowAt(columns, newRowIndex);
	return newRowIndex;
};

/**
 * Replace the existing contents of the existing row identified by
 * rowIndex with the new contents in the array of columns provided.
 */
com.qwirx.freebase.Grid.prototype.updateRow = function(rowIndex, columns)
{
	var oldRow = this.rows_[rowIndex];
	var numCols = columns.length;
	var cells = [];
	
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var td = oldRow[i].tableCell;
		td.innerHTML = oldRow[i].value = column.value;
	}
};

com.qwirx.freebase.Grid.prototype.getRowCount = function()
{
	return this.rowCount_;
};

com.qwirx.freebase.Grid.prototype.getRow = function(rowIndex)
{
	return this.rows_[rowIndex];
};

/**
 * Triggers an event. Copied from @link goog.jsaction.replay.triggerEvent_
 * because that one's private.
 * @param {!Element} elem The element to trigger the event on.
 * @param {!Event} event The event object.
 * @see http://stackoverflow.com/questions/5159806/how-do-i-synthesize-a-browser-click-event-on-a-div-element
 * @private
 */
/*
com.qwirx.freebase.Grid.prototype.triggerEvent_ = function(elem, event)
{
	if (elem.dispatchEvent)
	{
		elem.dispatchEvent(event);
	}
	else
	{
		goog.asserts.assert(elem.fireEvent);
		elem.fireEvent('on' + event.type, event);
	}
};
*/

com.qwirx.freebase.Grid.DragMode = {
	NONE: "NONE",
	TEXT: "TEXT",
	CELLS: "CELLS"
};

com.qwirx.freebase.Grid.prototype.handleMouseDown = function(e)
{
	// com.qwirx.freebase.log("mouse down: " + e.type + ": " + e.target);
	this.setAllowTextSelection(true);
		
	com.qwirx.freebase.Grid.superClass_.handleMouseDown.call(this, e);
	
	// remove existing selection
	var oldy1 = Math.min(this.drag.y1, this.drag.y2);
	var oldy2 = Math.max(this.drag.y1, this.drag.y2);
	
	for (var y = oldy1; y <= oldy2 && oldy1 >= 0; y++)
	{
		this.highlightRow(y, false);
	}

	// Highlighted rows will be reset when createHighlightRule_()
	// is called below, so don't waste effort doing it now.
	
	this.drag.x1 = this.drag.x2 = 
		e.target[com.qwirx.freebase.Grid.TD_ATTRIBUTE_COL];
	this.drag.y1 = this.drag.y2 = 
		e.target[com.qwirx.freebase.Grid.TD_ATTRIBUTE_ROW];
	this.drag.origin = e.target;
	
	this.setEditableCell(e.target);
	this.dragMode_ = com.qwirx.freebase.Grid.DragMode.TEXT;
	
	this.highlightRow(this.drag.y1, true);
	this.createHighlightRule_();
		
	return true;
};

com.qwirx.freebase.Grid.prototype.createHighlightRule_ = function()
{
	var builder = new goog.string.StringBuffer();
	
	var x1 = Math.min(this.drag.x1, this.drag.x2);
	var x2 = Math.max(this.drag.x1, this.drag.x2);

	// don't create any rules if x1 == -1, which means there are currently
	// no cell selected
	for (var x = x1; x <= x2 && x1 >= 0; x++)
	{
		builder.append('table#' + this.element_.id + ' > ' +
			'tr.highlight > td.col_' + x + ' { background: #ddf; }');
	}
	
	goog.style.setStyles(this.highlightStyles_, builder.toString());
};

com.qwirx.freebase.Grid.prototype.highlightRow = function(rowIndex, enable)
{
	this.getRenderer().enableClassName(this.rowElements_[rowIndex],
		'highlight', enable);
};

com.qwirx.freebase.Grid.prototype.handleDrag = function(e)
{
	// com.qwirx.freebase.log("dragging: " + e.type + ": " + e.target);

	/*
	if (!this.isActive())
	{
		// Don't change selection unless the mouse action button is down.
		// We can't tell directly because browsers don't set the button
		// property of mouseover events, but 
		// i.e. we have received a mousedown but no corresponding mouseup
		// event.
		return;
	}
	*/
	
	var be = e.browserEvent || e;
	var newx2 = be.target[com.qwirx.freebase.Grid.TD_ATTRIBUTE_COL];
	var newy2 = be.target[com.qwirx.freebase.Grid.TD_ATTRIBUTE_ROW];
	
	/*
	// if the new x2 is less than the old, reduce columns
	for (var x = newx2 + 1; x <= this.drag.x2; x++)
	{
		this.highlightColumn(x, false);
	}
	
	// if the new x2 is greater than the old, add columns
	for (var x = this.drag.x2 + 1; x <= newx2; x++)
	{
		this.highlightColumn(x, true);
	}
	*/
	
	var oldymin = Math.min(this.drag.y1, this.drag.y2);
	var oldymax = Math.max(this.drag.y1, this.drag.y2);
	var newymin = Math.min(this.drag.y1, newy2);
	var newymax = Math.max(this.drag.y1, newy2);

	// If selection is above y1 and moving down, unselect any rows between
	// the old and new minima.
	for (var y = oldymin; y < newymin; y++)
	{
		this.highlightRow(y, false);
	}
	
	// If selection is above y1 and moving up, select any rows between
	// the new and old minima.
	for (var y = newymin; y < oldymin; y++)
	{
		this.highlightRow(y, true);
	}
	
	// If selection is below y1 and moving down, select any rows between
	// the old and new maxima.
	for (var y = oldymax + 1; y <= newymax; y++)
	{
		this.highlightRow(y, true);
	}
	
	// If selection is below y1 and moving up, unselect any rows between
	// the new and old maxima.
	for (var y = newymax + 1; y <= oldymax; y++)
	{
		this.highlightRow(y, false);
	}

	this.drag.y2 = newy2;
	
	if (newx2 != this.drag.x2)
	{
		this.drag.x2 = newx2;
		this.createHighlightRule_();
	}
};

/**
 * Subclass @link goog.editor.SeamlessField to change the default
 * handleMouseDown_ behaviour to stop event propagation. Otherwise
 * the Grid's handleMouseDown handles the event next, calls
 * goog.ui.Control.prototype.handleMouseDown, which prevents the
 * default action, stopping editing events from being processed by
 * the browser, particularly focus clicks and range selections.
 *
 * But stopping the event propagation also breaks our own use of the
 * same event for selecting grid cells, bah!
 *
 * @param {string} id An identifer for the field. This is used to find the
 *     field and the element associated with this field.
 * @param {Document=} opt_doc The document that the element with the given
 *     id can be found it.
 * @constructor
 * @extends {goog.editor.SeamlessField}
 */
/*
com.qwirx.freebase.SeamlessField = function(id, opt_doc) {
  goog.editor.SeamlessField.call(this, id, opt_doc);
};
goog.inherits(com.qwirx.freebase.SeamlessField, goog.editor.SeamlessField);

com.qwirx.freebase.SeamlessField.prototype.handleMouseDown_ = function(e)
{
	com.qwirx.freebase.SeamlessField.superClass_.handleMouseDown_.call(this, e);
	e.stopPropagation();
};
*/

/**
 * Makes a particular cell editable, cancelling any other that was
 * editable before.
 */
com.qwirx.freebase.Grid.prototype.setEditableCell = function(cell)
{
	if (this.editableCellField_ &&
		this.editableCellField_.getOriginalElement() != cell)
	{
		this.editableCellField_.makeUneditable();
		this.editableCellField_.dispose();
		this.editableCellField_ = undefined;
	}
	
	if (!this.editableCellField_)
	{
		this.editableCellField_ = new goog.editor.SeamlessField(cell);
		this.editableCellField_.makeEditable();
		cell.focus();
		com.qwirx.freebase.log("set editable cell: " + cell);
		
		/* Refire the event to set the selection based on where exactly
		 * the user clicked within the control. The SeamlessField will
		 * stop propagation to prevent it returning here and causing
		 * an infinite loop.
		 */
		// this.triggerEvent_(e.target, e.getBrowserEvent());

		this.editableCellField_.addEventListener(
			goog.events.EventType.MOUSEDOWN, 
			function(e)
			{
				com.qwirx.freebase.log("captured: " +
					e.type + ": " + e.target);
			});
	}
};

com.qwirx.freebase.Grid.prototype.logEvent = function(e)
{
	com.qwirx.freebase.log("log event " + e.type + ": " + 
		e.target + " [x=" +
		e.target[com.qwirx.freebase.Grid.TD_ATTRIBUTE_COL] +
		", y=" +
		e.target[com.qwirx.freebase.Grid.TD_ATTRIBUTE_ROW] +
		"]");
};

/**
 * Handles dblclick events by making the selected cell editable,
 * cancelling any other currently editable cell.
 */
com.qwirx.freebase.Grid.prototype.handleMouseUp = function(e)
{
	this.logEvent(e);
	com.qwirx.freebase.Grid.superClass_.handleMouseUp.call(this, e);

	if (!this.isEnabled()) return;
	// this.setEditableCell(e.target);
	// e.target.focus();
	this.dragMode_ = com.qwirx.freebase.Grid.DragMode.NONE;
	this.setAllowTextSelection(true);
};

com.qwirx.freebase.Grid.prototype.handleMouseOver = function(e)
{
	// this.logEvent(e);
	com.qwirx.freebase.Grid.superClass_.handleMouseOver.call(this, e);

	if (this.dragMode_ != com.qwirx.freebase.Grid.DragMode.NONE)
	{
		// entering a different cell, update selection
		this.handleDrag(e);
	}
	
	if (this.dragMode_ == com.qwirx.freebase.Grid.DragMode.CELLS)
	{
		if (e.target == this.drag.origin)
		{
			// re-entering the cell where dragging started, restore the
			// original selection
			// https://groups.google.com/group/closure-library-discuss/browse_thread/thread/2da0f1f94c396d93

			com.qwirx.freebase.log("stop dragging");
			// this.dragger_.dispose();
		
			/*
			if (this.drag.savedSelection_)
			{
				this.drag.savedSelection_.restore();
				delete this.drag.savedSelection_;
			}
			*/

			com.qwirx.freebase.log("restored selection, switching to TEXT mode");
			this.dragMode_ = com.qwirx.freebase.Grid.DragMode.TEXT;
			this.setAllowTextSelection(true);
		}
		else
		{
			// stop drag events from reaching the browser, where they
			// would result in text selection
			// e.preventDefault();
		}
	}
};

/*
com.qwirx.freebase.Grid.prototype.startDrag = function(event)
{
	com.qwirx.freebase.log("start dragging");
	var grid = this;
	this.dragger_ = d = new goog.fx.Dragger(this.element_);
	d.addEventListener(goog.fx.Dragger.EventType.DRAG, 
		function(e)
		{
			grid.handleDrag(e);
			return true;
		});
	d.addEventListener(goog.fx.Dragger.EventType.END,
		function(e) {
			grid.handleDrag(e);
			d.dispose();
		});
	// d.startDrag(event);
}
*/

/*
com.qwirx.freebase.Grid.prototype.handleMouseMove = function(e)
{
	// this.logEvent(e);
	
	if (com.qwirx.freebase.Grid.superClass_.handleMouseMove)
	{
		com.qwirx.freebase.Grid.superClass_.handleMouseMove.call(this, e);
	}

	if (this.dragMode_ == com.qwirx.freebase.Grid.DragMode.CELLS)
	{
		// stop drag events from reaching the browser, where they
		// would result in text selection
		e.preventDefault();
		com.qwirx.freebase.log("mousemove suppressed: " +
			window.getSelection().anchorOffset);
			// window.getSelection().getRangeAt(0).getStart());
		this.handleDrag(e);
		return false;
	}
	else if (this.dragMode_ == com.qwirx.freebase.Grid.DragMode.TEXT)
	{
		com.qwirx.freebase.log("mousemove allowed: " +
			window.getSelection().anchorOffset);
	}
};
*/

com.qwirx.freebase.Grid.prototype.handleMouseOut = function(e)
{
	this.logEvent(e);
	com.qwirx.freebase.Grid.superClass_.handleMouseOut.call(this, e);

	if (this.dragMode_ == com.qwirx.freebase.Grid.DragMode.TEXT &&
		e.target == this.drag.origin)
	{
		// leaving the cell where dragging started, save the
		// original selection
		// https://groups.google.com/group/closure-library-discuss/browse_thread/thread/2da0f1f94c396d93

		/*
		var range = goog.dom.Range.createFromWindow();
		if (range)
		{
			this.drag.savedSelection_ = range.saveUsingDom();
			goog.dom.Range.clearSelection();
		}
		*/

		com.qwirx.freebase.log("saving selection, switching to CELLS mode");
		this.dragMode_ = com.qwirx.freebase.Grid.DragMode.CELLS;
		this.setAllowTextSelection(false);
		// this.startDrag(e);
	}
};

