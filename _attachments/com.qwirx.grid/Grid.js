goog.provide('com.qwirx.grid.Grid');

goog.require('com.qwirx.data.Cursor');
goog.require('com.qwirx.loader');
goog.require('com.qwirx.util.Array');
goog.require('com.qwirx.util.Enum');
goog.require('goog.ui.Control');
goog.require('goog.ui.Slider');
goog.require('goog.editor.SeamlessField');

/** @define {boolean} */ com.qwirx.grid.DEBUG = true;
 
com.qwirx.grid.log = function(var_args)
{
	if (com.qwirx.grid.DEBUG)
	{
		console.log.apply(console, arguments);
	}
};

/**
 * A grid component which displays data loaded from an underlying
 * data source.
 * @todo change the data source to a goog.ds.DataNode.
 * @constructor
 */
com.qwirx.grid.Grid = function(datasource, opt_renderer)
{
	opt_renderer = opt_renderer || com.qwirx.grid.Grid.RENDERER;
	goog.ui.Control.call(this, null, opt_renderer);
	
	this.dataSource_ = datasource;
	this.cursor_ = new com.qwirx.data.Cursor(datasource);
	var self = this;
	
	datasource.addEventListener(
		com.qwirx.data.Datasource.Events.ROW_COUNT_CHANGE,
		this.handleDataSourceRowCountChange, false, this);
	datasource.addEventListener(
		com.qwirx.data.Datasource.Events.ROWS_INSERT,
		function(e) { self.handleDataSourceRowsEvent(e,
			self.handleRowInsert); });
	datasource.addEventListener(
		com.qwirx.data.Datasource.Events.ROWS_UPDATE,
		function(e) { self.handleDataSourceRowsEvent(e,
			self.handleRowUpdate); });
	
	// focusing a grid isn't very useful and looks ugly in Chrome
	this.setSupportedState(goog.ui.Component.State.FOCUSED, false);
	
	this.drag = com.qwirx.grid.Grid.NO_SELECTION;
	
	this.scrollOffset_ = { x: 0, y: 0 };
};

goog.inherits(com.qwirx.grid.Grid, goog.ui.Control);

com.qwirx.grid.Grid.NO_SELECTION = {
	origin: undefined, x1: -1, y1: -1, x2: -1, y2: -1
};

com.qwirx.grid.Grid.RENDERER = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-grid');
	
com.qwirx.grid.Grid.prototype.createDom = function()
{
	this.element_ = this.dom_.createDom('div',
		this.getRenderer().getClassNames(this).join(' '));
	this.element_.style.height = "100%";
	
	this.scrollBarOuterDiv_ = this.dom_.createDom('div',
		'fb-grid-scroll-v');
	this.element_.appendChild(this.scrollBarOuterDiv_);

	this.dataDiv_ = this.dom_.createDom('div', 'fb-grid-data');
	this.element_.appendChild(this.dataDiv_);
	
	// NavigableGrid subclass relies on the scrollBar_ property
	// to extract our scrollbar and reparent its DOM element.
	this.scrollBar_ = new goog.ui.Slider;
	this.scrollBar_.decorate(this.scrollBarOuterDiv_);
	this.scrollBar_.setOrientation(goog.ui.Slider.Orientation.VERTICAL);
	this.scrollBar_.setMaximum(this.dataSource_.getRowCount());

	// Scrollbar value is inverted: the maximum value is at the top,
	// which is where we want to be initially.
	this.scrollBar_.setValue(this.dataSource_.getRowCount(), 0);

	// NavigableGrid subclass relies on the dataTable_ property
	// to extract our grid table and reparent it.
	this.dataTable_ = this.dom_.createDom('table',
		{'class': 'fb-grid-data-table'});
	this.dataTable_.id = goog.string.createUniqueString();
	this.dataDiv_.appendChild(this.dataTable_);

	var columns = this.dataSource_.getColumns();
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
	
	this.headerRow_ = this.dom_.createDom('tr', {}, colHeadingCells);
	this.dataTable_.appendChild(this.headerRow_);

	this.rows_ = [];
	this.highlightStyles_ = goog.style.installStyles('', this.element_);
	this.currentRowStyle_ = goog.style.installStyles('', this.element_);
	
	this.scrollOffset_ = {x: 0, y: 0};
};

/**
 * Can't add rows until we enter the document, because we need to
 * know whether they fit inside the container.
 */
com.qwirx.grid.Grid.prototype.enterDocument = function()
{
	com.qwirx.grid.Grid.superClass_.enterDocument.call(this);
	com.qwirx.loader.loadCss('com.qwirx.grid', 'grid.css');

	if (!this.cursor_)
	{
		return;
	}
	
	var container = this.dataDiv_;
	var containerPos = goog.style.getPageOffset(container);
	var containerBorder = goog.style.getBorderBox(container);	
	this.partialLastRow = false;	
	
	for (var i = 0; i < this.dataSource_.getRowCount(); i++)
	{
		this.handleRowInsert(i, this.dataSource_.getRow(i));

		// stolen from goog.style.scrollIntoContainerView 
		var element = this.rows_[i].getRowElement();
		if (element.clientHeight == 0)
		{
			throw new Error("A row element with zero height cannot " +
				"be added to a dynamic grid, since the number of " +
				"such rows cannot be calculated.");
		}
		
		var elementPos = goog.style.getPageOffset(element);
		if (elementPos.y + element.clientHeight >
			containerPos.y + container.clientHeight + containerBorder.top)
		{
			// This row can't be completely displayed in the
			// container. Don't add any more rows.
			this.partialLastRow = true;
			break;
		}
		
		if (i > 1000 || elementPos.y > 10000)
		{
			// emergency brakes!
			throw new Error("Emergency brakes!");
		}
	}
	
	// Scrollbar value is inverted: the maximum value is at the top,
	// which is where we want to be initially.
	
	// The rows have just been updated and we don't need to update
	// them again, so we delay setting the scroll event handler
	// until after we've done this.
	
	this.scrollBar_.setMaximum(this.dataSource_.getRowCount() -
		this.getFullyVisibleRowCount());
	this.scrollBar_.setValue(this.scrollBar_.getMaximum());

	this.scrollBar_.addEventListener(goog.ui.Component.EventType.CHANGE,
		this.handleScrollEvent, /* capture */ false, this);
	
	/*
	for (var eventName in com.qwirx.util.Array.withKeys('MOVE_FIRST',
		'MOVE_BACKWARD', 'MOVE_FORWARD', 'MOVE_LAST', 'MOVE_TO'))
	{
	}
	*/
	goog.events.listen(this.cursor_, 
		com.qwirx.data.Cursor.Events.MOVE_TO, this.onCursorMove,
		false, this);		
};

com.qwirx.grid.Grid.ATTR_PREFIX = 'com_qwirx_grid_';
	com.qwirx.grid.Grid.ATTR_PREFIX + 'grid_cell_type';
com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE =
	com.qwirx.grid.Grid.ATTR_PREFIX + 'grid_cell_type';
com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW = 
	com.qwirx.grid.Grid.ATTR_PREFIX + 'grid_row';
com.qwirx.grid.Grid.TD_ATTRIBUTE_COL = 
	com.qwirx.grid.Grid.ATTR_PREFIX + 'grid_col';

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
com.qwirx.grid.Grid.Row = function(grid, rowIndex, columns)
{
	this.grid_= grid;
	this.columns_ = columns;
	
	var th = this.tableCell_ = grid.dom_.createDom('th', {}, '');
	th[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE] =
		com.qwirx.grid.Grid.CellType.ROW_HEAD;
	th[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW] = this;

	var cells = [th];
	
	var numCols = columns.length;
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var cssClasses = 'col_' + i;
		var td = column.tableCell = grid.dom_.createDom('td', cssClasses,
			column.value.toString());
			
		td[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE] =
			com.qwirx.grid.Grid.CellType.MIDDLE;
		td[com.qwirx.grid.Grid.TD_ATTRIBUTE_COL] = grid.columns_[i];
		td[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW] = this;
			
		cells.push(td);
	}
	
	this.tableRowElement_ = grid.dom_.createDom('tr', {}, cells);
	this.tableRowElement_.id = "row_" + rowIndex;
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
	return goog.array.indexOf(this.grid_.rows_, this) +
		this.grid_.scrollOffset_.y;
};

com.qwirx.grid.Grid.Row.prototype.getRowElement = function()
{
	return this.tableRowElement_;
};

com.qwirx.grid.Grid.Row.prototype.getColumns = function()
{
	return this.columns_;
};

com.qwirx.grid.Grid.prototype.handleDataSourceRowCountChange = function(e)
{
	var rowCount = this.dataSource_.getRowCount();
	var newMax = 0;
	
	if (rowCount <= this.getFullyVisibleRowCount())
	{
		// Leave the maximum to 0 to disable scrolling.
	}
	else
	{
		newMax = rowCount - this.getFullyVisibleRowCount();
	}

	// Changing datasource row count so that no rows are visible
	// should however change position to keep at least one visible.
	if (this.scrollOffset_.y >= rowCount)
	{
		this.scrollOffset_.y = rowCount - 1;
	}

	// if the maximum is reduced to less than the current value,
	// the value will be adjusted to match it, which will trigger
	// a refreshAll(), so we suppress that by muting events.
	this.scrollBar_.rangeModel.setMute(true);
	this.scrollBar_.setMaximum(newMax);
	
	this.prepareForSelection();
	
	// if the highlighted range is completely outside the new
	// valid row range, reset it to defaults.
	if (this.drag.y1 >= rowCount && this.drag.y2 >= rowCount)
	{
		this.drag = com.qwirx.grid.Grid.NO_SELECTION;
	}
	// if only the upper limit is outside the range, reset it
	// to be within the range.
	else if (this.drag.y2 > this.drag.y1 && this.drag.y2 > rowCount)
	{
		this.drag.y2 = rowCount - 1;
	}
	else if (this.drag.y1 > this.drag.y2 && this.drag.y1 > rowCount)
	{
		this.drag.y1 = rowCount - 1;
	}

	// setValue will reset the mute flag, so we can't suppress it,
	// so let's take advantage of it to call refreshAll for us.
	// this.scrollBar_.setValue(newVal);
	this.scrollBar_.rangeModel.setMute(false);
	this.setScroll(this.scrollOffset_.x, this.scrollOffset_.y);
};

/**
 * Sets the scroll position of the grid, updating the scrollbars to
 * match.
 * @todo currently the x value is ignored.
 */
com.qwirx.grid.Grid.prototype.setScroll =
	function(x, y)
{
	this.scrollOffset_.y = y;
	var newVal = this.scrollBar_.getMaximum() - y;
	
	if (newVal < 0)
	{
		// Scrollbar is scrolled when it shouldn't be allowed.
		// Not sure whether to leave it out of sync, or force
		// an automatic scroll of the grid to keep them in sync.
		// For now I'll leave them out of sync, because changing
		// datasource row count so that grid has fewer rows
		// should not change position.
		newVal = 0; // doesn't correspond with actual grid scroll
	}

	if (this.scrollBar_.getValue() != newVal)
	{
		// triggers a refreshAll.
		this.scrollBar_.setValue(newVal);
	}
	else
	{
		// setting the scrollbar value to the same value will not
		// trigger a refreshAll, but we need it to show/hide rows.
		this.refreshAll();
		// {refreshAll} no longer updates the highlight rules for us,
		// so we have to do that ourselves.
		this.updateSelection_(/* force */ true);
	}	
};

com.qwirx.grid.Grid.prototype.handleDataSourceRowsEvent =
	function(event, handler)
{
	var rowIndexes = event.getAffectedRows();
	for (var i = 0; i < rowIndexes.length; i++)
	{
		handler.call(this, rowIndexes[i], 
			this.dataSource_.getRow(rowIndexes[i]));
	}
};

com.qwirx.grid.Grid.prototype.handleRowInsert =
	function(newRowIndex, columns)
{
	var numCols = columns.length;
	var row = new com.qwirx.grid.Grid.Row(this, newRowIndex, columns);
	this.rows_.splice(newRowIndex, 0, row);

	goog.dom.insertChildAt(this.dataTable_, row.getRowElement(),
		newRowIndex + 1 /* for header row */);
};

/*
com.qwirx.grid.Grid.prototype.appendRow = function(columns)
{
	var newRowIndex = this.getRowCount();
	this.insertRowAt(columns, newRowIndex);
	return newRowIndex;
};
*/

/**
 * Replace the existing contents of the existing row identified by
 * rowIndex with the new contents in the array of columns provided.
 */
com.qwirx.grid.Grid.prototype.handleRowUpdate = function(rowIndex,
	columns)
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

com.qwirx.grid.Grid.prototype.getVisibleRowCount = function()
{
	return this.rows_.length;
};

/**
 * @return the number of table rows created to display grid data,
 * minus one, because the last row is usually partly offscreen.
 */
com.qwirx.grid.Grid.prototype.getFullyVisibleRowCount = function()
{
	if (this.partialLastRow)
	{
		return this.rows_.length - 1;
	}
	else
	{
		return this.rows_.length;
	}
};

com.qwirx.grid.Grid.prototype.getColumnCount = function()
{
	return this.columns_.length;
};

/*
com.qwirx.grid.Grid.prototype.getRow = function(rowIndex)
{
	return this.rows_[rowIndex];
};
*/

com.qwirx.grid.Grid.CellType = {
	COLUMN_HEAD: "COLUMN_HEAD",
	ROW_HEAD: "ROW_HEAD",
	MIDDLE: "MIDDLE",
	CORNER: "CORNER"
};

com.qwirx.grid.Grid.DragMode = {
	NONE: "NONE",
	TEXT: "TEXT",
	CELLS: "CELLS",
	COLUMNS: "COLUMNS",
	ROWS: "ROWS"
};

/**
 * Stores the old selection state in this.oldSelection_ and
 * prepares a new one in this.drag.
 */
com.qwirx.grid.Grid.prototype.prepareForSelection = function(e)
{
	this.oldSelection_ = goog.object.clone(this.drag);
	if (this.drag == com.qwirx.grid.Grid.NO_SELECTION)
	{
		this.drag = {};
	}
};

com.qwirx.grid.Grid.prototype.handleMouseDown = function(e)
{
	com.qwirx.grid.Grid.superClass_.handleMouseDown.call(this, e);
	
	var info = this.getDragInfo(e);
	if (!info) return;

	this.cursor_.setPosition(info.row);
	this.updateCurrentRow_();
	
	this.prepareForSelection();
	this.drag.origin = e.target;
	
	// Remove existing highlight from rows. Highlighted columns
	// will be reset when updateSelection() calls
	// createHighlightRule_() below, so don't waste effort doing it now.

	if (info.cell.type == info.cell.types.COLUMN_HEAD)
	{
		// clicked on a header cell
		this.setAllowTextSelection(false);
		this.dragMode_ = info.drag.modes.COLUMNS;
		this.drag.x1 = this.drag.x2 = info.col;
		this.drag.y1 = 0;
		this.drag.y2 = this.dataSource_.getRowCount() - 1;
	}
	else if (info.cell.type == info.cell.types.ROW_HEAD)
	{
		// clicked on a header cell
		this.setAllowTextSelection(false);
		this.dragMode_ = info.drag.modes.ROWS;
		this.drag.x1 = 0;
		this.drag.x2 = this.getColumnCount() - 1;
		this.drag.y1 = this.drag.y2 = info.row;
	}
	else if (info.cell.type == info.cell.types.MIDDLE)
	{
		this.setAllowTextSelection(true);
		this.setEditableCell(e.target);
		this.dragMode_ = info.drag.modes.TEXT;
		this.drag.x1 = this.drag.x2 = info.col;
		this.drag.y1 = this.drag.y2 = info.row;
	}

	this.updateSelection_(false);
		
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
		builder.append('table#' + this.dataTable_.id + ' > ' +
			'tr.highlight > td.col_' + x + ' { background: #ddf; }');
	}
	
	goog.style.setStyles(this.highlightStyles_, builder.toString());
};

/**
 * Updates the CSS which applies to this row, to indicate whether
 * it contains any highlighted cells or not. The intersection of
 * the <code>highlight</code CSS class on the row, and the
 * set of highlighted columns, created by the CSS rules created by
 * {#createHighlightRule_}, tells the browser which cells should be
 * rendered in the highlight colour.
 */
com.qwirx.grid.Grid.Row.prototype.setHighlighted = function(enable)
{
	this.grid_.getRenderer().enableClassName(this.getRowElement(),
		'highlight', enable);
};

/**
 * Updates the CSS which applies to this row, to indicate whether
 * it is the currently active row, pointed to by the grid's cursor's
 * position, or not. Only one row should be current at any time.
 */
com.qwirx.grid.Grid.prototype.updateCurrentRow_ = function()
{
	var currentDataRowIndex = this.cursor_.getPosition();
	var currentVisibleRowIndex = currentDataRowIndex - 
		this.scrollOffset_.y;
	var css;
	
	if (currentVisibleRowIndex >= 0 && 
		currentVisibleRowIndex < this.rows_.length)
	{
		css = 'table#' + this.dataTable_.id +
			' > tr#row_' + currentVisibleRowIndex + 
			' > th { background-color: #88f; }';
	}
	else
	{
		css = "";
	}
	
	goog.style.setStyles(this.currentRowStyle_, css);
};

/**
 * @return some useful properties used by all drag/mouse handlers,
 * to reduce code duplication. Returns null if the event's target is
 * not a grid cell, which probably means that you should ignore the
 * event and return, or at least handle it differently.
 */
com.qwirx.grid.Grid.prototype.getDragInfo = function(event)
{
	// com.qwirx.freebase.log("dragging: " + e.type + ": " + e.target);

	var cellType = event.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_TYPE];

	if (!cellType)
	{
		// maybe an event for the whole table, not a cell?
		return null;
	}

	var info = {
		be: event.browserEvent || event,
		cell: {
			type: cellType,
			types: com.qwirx.grid.Grid.CellType
		},
		drag: {
			mode: this.dragMode_,
			modes: com.qwirx.grid.Grid.DragMode
		}
	};
	
	var col = event.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_COL];
	var row = event.target[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW];
	
	info.col = col ? col.getColumnIndex() : null;
	info.row = row ? row.getRowIndex()    : null;
	
	return info;
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
	
	var info = this.getDragInfo(e);
	if (!info) return;

	this.prepareForSelection();

	// compute the new x2 and y2 using the above table
	if (info.drag.mode == info.drag.modes.ROWS)
	{
		this.drag.x2 = this.getColumnCount() - 1;
	}
	else if (info.cell.type == info.cell.types.ROW_HEAD)
	{
		this.drag.x2 = this.scrollOffset_.x;
	}
	else if (info.col != null)
	{
		this.drag.x2 = info.col;
	}
	else
	{
		// no change to x2
	}
	
	if (info.drag.mode == info.drag.modes.COLUMNS)
	{
		this.drag.y2 = this.dataSource_.getRowCount() - 1;
	}
	else if (info.cell.type == info.cell.types.COLUMN_HEAD)
	{
		this.drag.y2 = this.scrollOffset_.y;
	}
	else if (info.row != null)
	{
		this.drag.y2 = info.row;
	}
	else
	{
		// no change to y2
	}
	
	this.updateSelection_(false);
};

/**
 * Set the current highlight corners to the provided values, and
 * update the grid highlight CSS to match them.
 *
 * @param x1 The first highlighted column index.
 * @param y1 The first highlighted row index.
 * @param x2 The last highlighted column index.
 * @param y2 The last highlighted row index.
 */
com.qwirx.grid.Grid.prototype.setSelection = function(x1, y1, x2, y2)
{
	this.prepareForSelection();
	this.drag.x1 = x1;
	this.drag.x2 = x2;
	this.drag.y1 = y1;
	this.drag.y2 = y2;
	this.updateSelection_(false);
};

/**
 * Update the CSS highlight rules and classes so that the visible
 * state of the grid matches the selection recorded in this.drag.
 * In order for this to work efficiently, it requires you to store
 * a cloned copy of the old selection parameters (this.drag) in
 * this.oldSelection_ before you update them. It only applies changes
 * to the difference between this.oldSelection_ and this.drag.
 *
 * @param force Force the recreation of highlight rules and classes
 * even if the x or y parameters appear not to have changed between
 * this.oldSelection_ and this.drag. This is useful when scrolling
 * to ensure that any selection changes are brought into view.
 */
com.qwirx.grid.Grid.prototype.updateSelection_ = function(force)
{	
	var oldSel = this.oldSelection_;
	var newSel = this.drag;

	if (!force && oldSel)
	{
		com.qwirx.grid.log("selection changed from " +
			oldSel.x2 + "," + oldSel.y2 + " to " +
			newSel.x2 + "," + newSel.y2);
	}
	
	// changes to y2 are handled by (un)highlighting rows.
	
	if (force || oldSel && (newSel.y1 != oldSel.y1 || newSel.y2 != oldSel.y2))
	{
		var ymin = Math.min(newSel.y1, newSel.y2);
		var ymax = Math.max(newSel.y1, newSel.y2);

		for (var gridRow = 0; gridRow < this.rows_.length; gridRow++)
		{
			var dataRow = this.scrollOffset_.y + gridRow;
			this.rows_[gridRow].setHighlighted(dataRow >= ymin &&
				dataRow <= ymax);
		}
	}	

	// changes to x2 are handled by rewriting the highlight rule.

	if (force || oldSel && (newSel.x1 != oldSel.x1 || newSel.x2 != oldSel.x2))
	{
		this.createHighlightRule_();
	}
	
	this.drag = newSel;
	delete this.oldSelection_;
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
		com.qwirx.grid.log("set editable cell: " + newCell);
		
		this.editableCellField_.addEventListener(
			goog.events.EventType.MOUSEDOWN, 
			function(e)
			{
				com.qwirx.grid.log("captured: " +
					e.type + ": " + e.target);
			});
	}
};

com.qwirx.grid.Grid.prototype.logEvent = function(e)
{
	var info = this.getDragInfo(e);
	var col, row;
	
	if (info.cell.type == info.cell.types.ROW_HEAD ||
		info.cell.type == info.cell.types.CORNER)
	{
		col = "H";
	}
	else
	{
		col = info.col;
	}
	
	if (info.cell.type == info.cell.types.COLUMN_HEAD ||
		info.cell.type == info.cell.types.CORNER)
	{
		row = "H";
	}
	else
	{
		row = info.row;
	}
	
	com.qwirx.grid.log("log event " + e.type + ": " + 
		e.target + " [x=" + col + ", y=" + row + "]");
};

/**
 * Turns off cell selection by dragging, and allows text selection
 * again within the editable cell.
 */
com.qwirx.grid.Grid.prototype.handleMouseUp = function(e)
{
	com.qwirx.grid.Grid.superClass_.handleMouseUp.call(this, e);
	
	var info = this.getDragInfo(e);
	if (!info) return;

	this.logEvent(e);

	if (!this.isEnabled()) return;
	this.dragMode_ = info.drag.modes.NONE;
	this.setAllowTextSelection(true);
};

com.qwirx.grid.Grid.prototype.handleMouseOver = function(e)
{
	com.qwirx.grid.Grid.superClass_.handleMouseOver.call(this, e);

	var info = this.getDragInfo(e);
	if (!info) return;

	// this.logEvent(e);

	if (info.drag.mode != info.drag.modes.NONE)
	{
		// entering a different cell, update selection
		this.handleDrag(e);
	}
	
	if (info.drag.mode == info.drag.modes.CELLS)
	{
		if (e.target == this.drag.origin)
		{
			// re-entering the cell where dragging started, restore the
			// original selection, by just re-enabling text selection.

			com.qwirx.grid.log("restored selection, switching to TEXT mode");
			this.dragMode_ = info.drag.modes.TEXT;
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

	var info = this.getDragInfo(e);
	if (!info) return;

	if (info.drag.mode == info.drag.modes.TEXT &&
		e.target == this.drag.origin)
	{
		// leaving the cell where dragging started, disable text
		// selection to avoid messy interaction with cell selection.

		com.qwirx.grid.log("saving selection, switching to CELLS mode");
		this.dragMode_ = info.drag.modes.CELLS;
		this.setAllowTextSelection(false);
		this.setEditableCell(null);
	}
};

/**
 * Reloads all the data in all cells in the grid. It does not
 * change the highlight rules. If you want that, you need to call
 * {updateSelection_} separately. We used to do it here, because they
 * are often called together, but that prevents decoupling and
 * eventual replacement of {replaceAll}.
 *
 * @deprecated This is basically an inefficient and ugly hack.
 * The only time you would need to call this is when scrolling
 * by a large amount, and in general we should transfer data from
 * already-loaded rows where possible, rather than discarding
 * unsaved changes, and only reload newly exposed rows.
 */
com.qwirx.grid.Grid.prototype.refreshAll = function()
{
	var len = this.rows_.length;
	
	for (var i = 0; i < len; i++)
	{
		var dataRow = i + this.scrollOffset_.y;
		var visible = (dataRow < this.dataSource_.getRowCount());
		this.rows_[i].setVisible(visible);
		
		if (visible)
		{
			var columns = this.dataSource_.getRow(dataRow);
			this.handleRowUpdate(i, columns);
		}
	}
	
	this.updateCurrentRow_();
};

com.qwirx.grid.Grid.Row.prototype.setVisible = function(visible)
{
	this.grid_.renderer_.setVisible(this.getRowElement(), visible);
};

com.qwirx.grid.Grid.prototype.handleScrollEvent = function(e)
{
	// calls refreshAll() for us
	this.setScroll(this.scrollOffset_.x,
		e.target.getMaximum() - e.target.getValue());

	com.qwirx.grid.log("scroll offset changed to " + 
		this.scrollOffset_.y + " for " + e.target.getMaximum() + "," +
			e.target.getValue());
};

com.qwirx.grid.Grid.prototype.getDatasource = function()
{
	return this.dataSource_;
};

/**
 * Responds to a cursor move event by ensuring that the current
 * position row is visible, and the data displayed is correct for
 * the scroll position.
 */
com.qwirx.grid.Grid.prototype.onCursorMove = function(event)
{
	var events = com.qwirx.data.Cursor.Events;
	var oldScroll = this.scrollOffset_.y;
	var newScroll = oldScroll;
	var firstRowVisible = oldScroll;
	var lastRowVisible = oldScroll + this.getFullyVisibleRowCount() - 1;
	var activeRow = event.newPosition;
	
	if (activeRow == com.qwirx.data.Cursor.BOF)
	{
		newScroll = 0;
	}
	else if (activeRow == com.qwirx.data.Cursor.EOF)
	{
		var numRows = this.dataSource_.getRowCount();
		if (numRows != null)
		{
			newScroll = numRows - this.getFullyVisibleRowCount();
		}
	}
	else if (activeRow < firstRowVisible)
	{
		newScroll += activeRow - firstRowVisible; // negative
	}
	else if (activeRow > lastRowVisible)
	{
		newScroll += activeRow - lastRowVisible; // positive
	}

	// TODO test what happens if DS has fewer rows than grid
	// TODO test what happens when newScroll < 0
	// TODO test what happens when newScroll > this.dataSource_.getRowCount()

	this.setScroll(this.scrollOffset_.x, newScroll);
	// calls refreshAll() for us
};

/**
 * @return the {com.qwirx.data.Cursor} that represents the current or
 * active record in this grid.
 */
com.qwirx.grid.Grid.prototype.getCursor = function()
{
	return this.cursor_;
};

