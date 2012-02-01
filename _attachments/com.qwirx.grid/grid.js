goog.provide('com.qwirx.grid.Grid');
goog.require('com.qwirx.loader');

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

com.qwirx.grid.Grid = function(columns_or_datasource, opt_renderer)
{
	opt_renderer = opt_renderer || com.qwirx.grid.Grid.RENDERER;
	goog.ui.Control.call(this, null, opt_renderer);
	
	if (columns_or_datasource.getRow)
	{
		this.dataSource_ = columns_or_datasource;
		this.columns_ = columns_or_datasource.getColumns().slice(0); // copy
	}
	else
	{
		this.columns_ = columns_or_datasource.slice(0); // copy
	}
	
	// focusing a grid isn't very useful and looks ugly in Chrome
	this.setSupportedState(goog.ui.Component.State.FOCUSED, false);
	
	this.drag = { origin: undefined, x1: -1, y1: -1, x2: -1, y2: -1 };
	
	this.scrollOffset_ = { x: 0, y: 0 };
};

goog.inherits(com.qwirx.grid.Grid, goog.ui.Control);

com.qwirx.grid.Grid.RENDERER = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-grid');
	
/**
 * Capture the parent element because enterDocument needs it.
 */
com.qwirx.grid.Grid.prototype.render = function(opt_parentElement)
{
	if (opt_parentElement)
	{
		var parent = opt_parentElement;
	}
	else
	{
		var parent = this.dom_.getDocument().body;
	}
	
	this.fb_parent_ = parent;
	com.qwirx.grid.Grid.superClass_.render.call(this, 
		opt_parentElement);
};

com.qwirx.grid.Grid.prototype.createDom = function()
{
	this.element_ = this.dom_.createDom('table',
		this.getRenderer().getClassNames(this).join(' '));
	this.element_.id = goog.string.createUniqueString();

	var columns = this.columns_;
	var numCols = columns.length;

	var cornerCell = this.dom_.createDom('th', {});
	cornerCell[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE] =
		com.qwirx.grid.Grid.CellType.CORNER;
	var colHeadingCells = [cornerCell];
	this.columns_ = [];
	
	for (var i = 0; i < numCols; i++)
	{
		var columnInfo = columns[i];
		var column = new com.qwirx.grid.Grid.Column(this,
			columnInfo.caption);
		this.columns_.push(column);
		colHeadingCells.push(column.getIdentityNode());
	}
	
	this.headerRow_ = this.dom_.createDom('tr', {},
		colHeadingCells);
	this.element_.appendChild(this.headerRow_);
	
	this.rows_ = [];
	this.rowElements_ = [];
	this.highlightStyles_ = goog.style.installStyles('', this.element_);
};

/**
 * Can't add rows until we enter the document, because we need to
 * know whether they fit inside the container.
 */
com.qwirx.grid.Grid.prototype.enterDocument = function()
{
	com.qwirx.grid.Grid.superClass_.enterDocument.call(this);
	com.qwirx.loader.loadCss('com.qwirx.grid', 'grid.css');

	if (!this.dataSource_)
	{
		return;
	}
	
	var container = this.fb_parent_;
	var containerPos = goog.style.getPageOffset(container);
	var containerBorder = goog.style.getBorderBox(container);		
	
	for (var i = 0; i < this.dataSource_.getRowCount(); i++)
	{
		this.appendRow(this.dataSource_.getRow(i));

		// stolen from goog.style.scrollIntoContainerView 
		var element = this.rowElements_[i];
		var elementPos = goog.style.getPageOffset(element);
		if (elementPos.y + element.clientHeight >
			containerPos.y + container.clientHeight + containerBorder.top)
		{
			// This row can't be completely displayed in the
			// container. Don't add any more rows.
			break;
		}
		
		if (elementPos.y + element.clientHeight > 10000)
		{
			// emergency brakes!
			break;
		}
	}
};

com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE =
	com.qwirx.freebase.Freebase.FREEBASE_FIELD_PREFIX + 'grid_cell_type';
com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW = 
	com.qwirx.freebase.Freebase.FREEBASE_FIELD_PREFIX + 'grid_row';
com.qwirx.grid.Grid.TD_ATTRIBUTE_COL = 
	com.qwirx.freebase.Freebase.FREEBASE_FIELD_PREFIX + 'grid_col';

/**
 * Column is a class, not a static index, to allow renumbering and
 * dynamically numbering large grids quickly.
 */
com.qwirx.grid.Grid.Column = function(grid, caption)
{
	this.grid_= grid;
	var th = this.tableCell_ = grid.dom_.createDom('th', {}, caption);
	th[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE] =
		com.qwirx.grid.Grid.CellType.COLUMN_HEAD;
	th[com.qwirx.grid.Grid.TD_ATTRIBUTE_COL] = this;
};

com.qwirx.grid.Grid.Column.prototype.getColumnIndex = function()
{
	return goog.array.indexOf(this.grid_.columns_, this);
};

/**
 * @return the DOM node for the cell above the first data cell,
 * which normally displays a column number, and on which the user
 * can click to select the entire column.
 */
com.qwirx.grid.Grid.Column.prototype.getIdentityNode = function()
{
	return this.tableCell_;
};

/**
 * Row is a class, not a static index, to allow renumbering and
 * dynamically numbering large grids quickly.
 */
com.qwirx.grid.Grid.Row = function(grid, columns)
{
	this.grid_= grid;
	this.columns_ = columns;
	var th = this.tableCell_ = grid.dom_.createDom('th', {}, '');
	th[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE] =
		com.qwirx.grid.Grid.CellType.ROW_HEAD;
	th[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW] = this;
};

/**
 * @return the DOM node for the cell above the first data cell,
 * which normally displays a column number, and on which the user
 * can click to select the entire column.
 */
com.qwirx.grid.Grid.Row.prototype.getIdentityNode = function()
{
	return this.tableCell_;
};

com.qwirx.grid.Grid.Row.prototype.getRowIndex = function()
{
	return goog.array.indexOf(this.grid_.rows_, this);
};

com.qwirx.grid.Grid.Row.prototype.getColumns = function()
{
	return this.columns_;
};

com.qwirx.grid.Grid.prototype.insertRowAt = function(columns, newRowIndex)
{
	var numCols = columns.length;
	var row = new com.qwirx.grid.Grid.Row(this, columns);
	this.rows_.splice(newRowIndex, 0, row);

	var cells = [row.getIdentityNode()];
	
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var cssClasses = 'col_' + i;
		var td = column.tableCell = this.dom_.createDom('td', cssClasses,
			column.value);
			
		td[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE] =
			com.qwirx.grid.Grid.CellType.MIDDLE;
		td[com.qwirx.grid.Grid.TD_ATTRIBUTE_COL] =
			this.columns_[i];
		td[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW] = row;
			
		cells.push(td);
	}
	
	var newTableRow = this.dom_.createDom('tr', {}, cells);
	goog.dom.insertChildAt(this.element_, newTableRow,
		newRowIndex + 1 /* for header row */);
	
	this.rowElements_.splice(newRowIndex, 0, newTableRow);
};

com.qwirx.grid.Grid.prototype.appendRow = function(columns)
{
	var newRowIndex = this.getRowCount();
	this.insertRowAt(columns, newRowIndex);
	return newRowIndex;
};

/**
 * Replace the existing contents of the existing row identified by
 * rowIndex with the new contents in the array of columns provided.
 */
com.qwirx.grid.Grid.prototype.updateRow = function(rowIndex, columns)
{
	var oldRow = this.rows_[rowIndex];
	var numCols = columns.length;
	var cells = [];
	
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var td = oldRow.columns_[i].tableCell;
		td.innerHTML = oldRow.columns_[i].value = column.value;
	}
};

com.qwirx.grid.Grid.prototype.getRowCount = function()
{
	return this.rows_.length;
};

com.qwirx.grid.Grid.prototype.getColumnCount = function()
{
	return this.columns_.length;
};

com.qwirx.grid.Grid.prototype.getRow = function(rowIndex)
{
	return this.rows_[rowIndex];
};

com.qwirx.grid.Grid.CellType = {
	COLUMN_HEAD: "COLUMN_HEAD",
	ROW_HEAD: "ROW_HEAD",
	MIDDLE: "MIDDLE",
	CORNER: "CORNER",
};

com.qwirx.grid.Grid.DragMode = {
	NONE: "NONE",
	TEXT: "TEXT",
	CELLS: "CELLS",
	COLUMNS: "COLUMNS",
	ROWS: "ROWS"
};

com.qwirx.grid.Grid.prototype.handleMouseDown = function(e)
{
	com.qwirx.grid.Grid.superClass_.handleMouseDown.call(this, e);
	
	// Remove existing highlight from rows. Highlighted columns
	// will be reset when createHighlightRule_() is called below,
	// so don't waste effort doing it now.

	var oldy1 = Math.min(this.drag.y1, this.drag.y2);
	var oldy2 = Math.max(this.drag.y1, this.drag.y2);
	
	for (var y = oldy1; y <= oldy2 && oldy1 >= 0; y++)
	{
		this.highlightRow(y, false);
	}

	var type = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE];
	var col = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_COL];
	var row = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW];

	this.drag.origin = e.target;
	
	if (type == com.qwirx.grid.Grid.CellType.COLUMN_HEAD)
	{
		// clicked on a header cell
		this.setAllowTextSelection(false);
		this.dragMode_ = com.qwirx.grid.Grid.DragMode.COLUMNS;
		this.drag.x1 = this.drag.x2 = col.getColumnIndex();
		this.drag.y1 = 0;
		this.drag.y2 = this.getRowCount() - 1;
	}
	else if (type == com.qwirx.grid.Grid.CellType.ROW_HEAD)
	{
		// clicked on a header cell
		this.setAllowTextSelection(false);
		this.dragMode_ = com.qwirx.grid.Grid.DragMode.ROWS;
		this.drag.x1 = 0;
		this.drag.x2 = this.getColumnCount() - 1;
		this.drag.y1 = this.drag.y2 = row.getRowIndex();
	}
	else if (type == com.qwirx.grid.Grid.CellType.MIDDLE)
	{
		this.setAllowTextSelection(true);
		this.setEditableCell(e.target);
		this.dragMode_ = com.qwirx.grid.Grid.DragMode.TEXT;
		this.drag.x1 = this.drag.x2 = col.getColumnIndex();
		this.drag.y1 = this.drag.y2 = row.getRowIndex();
	}
	
	for (var y = this.drag.y1; y <= this.drag.y2; y++)
	{
		this.highlightRow(y, true);
	}
	
	this.createHighlightRule_();
		
	return true;
};

/**
 * Replace the contents of the style element that marks highlighted
 * cells when their row has the <code>highlight</code> class. This
 * mechanism means that updating the highlight is O(r+c) instead of
 * O(r*c), because we don't have to visit every cell to apply
 * (or remove) a highlight style to it.
 */
com.qwirx.grid.Grid.prototype.createHighlightRule_ = function()
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

com.qwirx.grid.Grid.prototype.highlightRow = function(rowIndex, enable)
{
	this.getRenderer().enableClassName(this.rowElements_[rowIndex],
		'highlight', enable);
};

/**
 * Update the selection (of cells in the grid) based on a mouse
 * movement event.
 * <p>
 * The way the selection is updated depends on the current
 * {@link com.qwirx.grid.Grid.DragMode selection mode} and the
 * {@link com.qwirx.grid.Grid.CellType cell type} of the cell
 * which the mouse entered.
 *
 * <dl>
 * <dt>0</dt>
 * <dd>Zero (lowest row/column number in grid)</dd>
 * <dt>inf</dt>
 * <dd>Highest row/column number in grid</dd>
 * <dt>x</dt>
 * <dd>The x coordinate of the cell just entered</dd>
 * <dt>y</dt>
 * <dd>The y coordinate of the cell just entered</dd>
 * <dt>min</dt>
 * <dd>The lowest x/y coordinate visible (this.scrollOffset_.x/y)</dd>
 * <dt>max</dt>
 * <dd>The highest x/y coordinate visible (this.scrollOffset_.x/y plus
 * this.visibleArea_.rows/cols)</dd>
 * </dl>
 *
 * <pre>
 *             | CELLS     | COLUMNS   | ROWS      | Drag mode
 *             |-----------|-----------|-----------|
 *             | x2  | y2  | x2  | y2  | x2  | y2  |
 *             |-----|-----|-----|-----|-----|-----|
 * MIDDLE      | x   | y   | x   | inf | inf | y   |
 * COLUMN_HEAD | x   | min | x   | inf | inf | min |
 * ROW_HEAD    | min | y   | min | inf | inf | y   |
 * Cell type   |
 * </pre>
 */
com.qwirx.grid.Grid.prototype.handleDrag = function(e)
{
	// com.qwirx.freebase.log("dragging: " + e.type + ": " + e.target);

	var be = e.browserEvent || e;

	var cellType = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE];
	var cellTypes = com.qwirx.grid.Grid.CellType;
	
	if (!cellType)
	{
		// maybe an event for the whole table, not a cell?
		return;
	}
	
	var dragMode = this.dragMode_;
	var dragModes = com.qwirx.grid.Grid.DragMode;
	var col = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_COL];
	var row = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW];
	
	var newx2, newy2;

	// compute the new x2 and y2 using the above table
	if (dragMode == dragModes.ROWS)
	{
		newx2 = this.getColumnCount() - 1;
	}
	else if (cellType == cellTypes.ROW_HEAD)
	{
		newx2 = this.scrollOffset_.x;
	}
	else if (col)
	{
		newx2 = col.getColumnIndex();
	}
	else
	{
		newx2 = this.drag.x2;
	}
	
	if (dragMode == dragModes.COLUMNS)
	{
		newy2 = this.getRowCount() - 1;
	}
	else if (cellType == cellTypes.COLUMN_HEAD)
	{
		newy2 = this.scrollOffset_.y;
	}
	else if (row)
	{
		newy2 = row.getRowIndex();
	}
	else
	{
		newy2 = this.drag.y2;
	}
	
	com.qwirx.freebase.log("dragging: selection changed from " +
		this.drag.x2 + "," + this.drag.y2 + " to " +
		newx2 + "," + newy2);

	// changes to y2 are handled by (un)highlighting rows.
	
	if (newy2 != this.drag.y2)
	{
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
	}	

	// changes to x2 are handled by rewriting the highlight rule.

	if (newx2 != this.drag.x2)
	{
		this.drag.x2 = newx2;
		this.createHighlightRule_();
	}
};

/**
 * Makes a particular cell editable, cancelling any other that was
 * editable before.
 */
com.qwirx.grid.Grid.prototype.setEditableCell = function(newCell)
{
	if (this.editableCellField_ &&
		this.editableCellField_.getOriginalElement() != newCell)
	{
		this.editableCellField_.makeUneditable();
		this.editableCellField_.dispose();
		this.editableCellField_ = undefined;
	}
	
	if (newCell && !this.editableCellField_)
	{
		this.editableCellField_ = new goog.editor.SeamlessField(newCell);
		this.editableCellField_.makeEditable();
		newCell.focus();
		com.qwirx.freebase.log("set editable cell: " + newCell);
		
		this.editableCellField_.addEventListener(
			goog.events.EventType.MOUSEDOWN, 
			function(e)
			{
				com.qwirx.freebase.log("captured: " +
					e.type + ": " + e.target);
			});
	}
};

com.qwirx.grid.Grid.prototype.logEvent = function(e)
{
	var row = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW];
	var col = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_COL];
	var cellType = e.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE];
	var cellTypes = com.qwirx.grid.Grid.CellType;
	
	if (cellType == cellTypes.ROW_HEAD ||
		cellType == cellTypes.CORNER)
	{
		col = "H";
	}
	else
	{
		col = col.getColumnIndex();
	}
	
	if (cellType == cellTypes.COLUMN_HEAD ||
		cellType == cellTypes.CORNER)
	{
		row = "H";
	}
	else
	{
		row = row.getRowIndex();
	}
	
	com.qwirx.freebase.log("log event " + e.type + ": " + 
		e.target + " [x=" + col + ", y=" + row + "]");
};

/**
 * Turns off cell selection by dragging, and allows text selection
 * again within the editable cell.
 */
com.qwirx.grid.Grid.prototype.handleMouseUp = function(e)
{
	this.logEvent(e);
	com.qwirx.grid.Grid.superClass_.handleMouseUp.call(this, e);

	if (!this.isEnabled()) return;
	this.dragMode_ = com.qwirx.grid.Grid.DragMode.NONE;
	this.setAllowTextSelection(true);
};

com.qwirx.grid.Grid.prototype.handleMouseOver = function(e)
{
	// this.logEvent(e);
	com.qwirx.grid.Grid.superClass_.handleMouseOver.call(this, e);

	if (this.dragMode_ != com.qwirx.grid.Grid.DragMode.NONE)
	{
		// entering a different cell, update selection
		this.handleDrag(e);
	}
	
	if (this.dragMode_ == com.qwirx.grid.Grid.DragMode.CELLS)
	{
		if (e.target == this.drag.origin)
		{
			// re-entering the cell where dragging started, restore the
			// original selection, by just re-enabling text selection.

			com.qwirx.freebase.log("restored selection, switching to TEXT mode");
			this.dragMode_ = com.qwirx.grid.Grid.DragMode.TEXT;
			this.setAllowTextSelection(true);
			this.setEditableCell(e.target);
		}
		else
		{
			// stop drag events from reaching the browser, where they
			// would result in text selection
			// e.preventDefault();
		}
	}
};

com.qwirx.grid.Grid.prototype.handleMouseOut = function(e)
{
	// this.logEvent(e);
	com.qwirx.grid.Grid.superClass_.handleMouseOut.call(this, e);

	if (this.dragMode_ == com.qwirx.grid.Grid.DragMode.TEXT &&
		e.target == this.drag.origin)
	{
		// leaving the cell where dragging started, disable text
		// selection to avoid messy interaction with cell selection.

		com.qwirx.freebase.log("saving selection, switching to CELLS mode");
		this.dragMode_ = com.qwirx.grid.Grid.DragMode.CELLS;
		this.setAllowTextSelection(false);
		this.setEditableCell(null);
	}
};

