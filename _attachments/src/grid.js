goog.provide('com.qwirx.freebase.Grid');
goog.require('goog.ui.Control');

com.qwirx.freebase.Grid = function(columns, opt_renderer)
{
	opt_renderer = opt_renderer || com.qwirx.freebase.Grid.RENDERER;
	goog.ui.Control.call(this, null, opt_renderer);
	this.columns_ = columns.slice(0); // copy
	
	// focusing a grid isn't very useful and looks ugly in Chrome
	this.setSupportedState(goog.ui.Component.State.FOCUSED, false);
	
	this.drag = { x1: -1, y1: -1, x2: -1, y2: -1 };
};

goog.inherits(com.qwirx.freebase.Grid, goog.ui.Control);

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

com.qwirx.freebase.Grid.prototype.handleMouseDown = function(e)
{
	com.qwirx.freebase.Grid.superClass_.handleMouseDown.call(this, e);
	var self = this;
	
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
	
	this.highlightRow(this.drag.y1, true);
	this.createHighlightRule_();
	
	var d = new goog.fx.Dragger(this.element_);
	d.addEventListener(goog.fx.Dragger.EventType.DRAG, 
		function(e)
		{
			self.handleDrag(e);
		});
	d.addEventListener(goog.fx.Dragger.EventType.END,
		function(e) {
			self.handleDrag(e);
			d.dispose();
		});
	d.startDrag(e);
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
	
	var be = e.browserEvent;
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


