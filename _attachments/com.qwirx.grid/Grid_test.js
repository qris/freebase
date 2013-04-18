goog.provide('com.qwirx.grid.Grid_test');

goog.require('com.qwirx.grid.Grid');
goog.require('com.qwirx.grid.NavigableGrid');
goog.require('com.qwirx.data.SimpleDatasource');
goog.require('com.qwirx.test.FakeBrowserEvent');
goog.require('com.qwirx.test.FakeClickEvent');
goog.require('com.qwirx.test.assertThrows');
goog.require('com.qwirx.test.findDifferences');

goog.require('goog.dom.NodeIterator');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.MockControl');

var domContainer = goog.dom.createDom(goog.dom.TagName.DIV,
	{'style': 'background-color: #eee; width: 50%; height: 400px; ' +
	'float: right;'});
goog.dom.appendChild(document.body, domContainer);

var mockController, columns, data, ds;

function setUp()
{
	// goog.style.setHeight(domContainer, 300);
	domContainer.style.height = '300px';
	domContainer.style.overflow = 'hidden';
	goog.dom.removeChildren(domContainer);
	
	columns = [
		{name: 'product', caption: 'Product'},
		{name: 'strength', caption: 'Special Ability'},
		{name: 'weakness', caption: 'Hidden Weakness'}
	];
	data = [
		{product: 'milk', strength: 'Reduces bitterness, especially in adults',
			weakness: 'Goes bad quickly, not vegan compatible'},
		{product: 'rye bread', strength: 'Can be used to make boxes',
			weakness: 'Tastes like cardboard'},
		{product: 'nuts', strength: 'Full of essential oils',
			weakness: 'Expensive'},
		{product: 'soymilk', strength: 'Long life, vegan compatible',
			weakness: 'Tastes like cardboard'},
	];
	ds = new com.qwirx.data.SimpleDatasource(columns, data);
	
	mockController = new goog.testing.MockControl();
}

function tearDown()
{
	mockController.$tearDown();
}

function initGrid(datasource)
{
	var grid = new com.qwirx.grid.NavigableGrid(datasource);
	grid.addClassName('fb-datagrid');
	grid.render(domContainer);

	// grid should initially display the top left corner
	assertObjectEquals({x: 0, y: 0}, grid.scrollOffset_);
	
	// grid container and scrolling container should fill the
	// available space
	assertEquals('100%', grid.getElement().style.height);
	
	// data div height + nav bar height should equal total height
	assertEquals(grid.getElement().clientHeight,
		grid.dataDiv_.clientHeight + grid.nav_.getElement().clientHeight);
	
	// grid should not have any rows outside the visible area
	// of the data div
	var rows = grid.dataTable_.children[0].children;
	var lastRow = rows[rows.length - 1];
	var container = grid.dataDiv_;
	var containerPos = goog.style.getPageOffset(container);
	var lastRowPos = goog.style.getPageOffset(lastRow);
	var remainingSpace = (containerPos.y + container.clientHeight) -
		(lastRowPos.y + lastRow.clientHeight);
	assertTrue(remainingSpace > 0);
	
	// a click which doesn't change the row selection should not
	// cause an error
	assertSelection(grid, "initial state should be no selection",
		-1, -1, -1, -1);
	
	return grid;
}

function assertSelection(grid, message, x1, y1, x2, y2)
{
	// shortcut to avoid comparing origin, which is a DOM node that
	// leads to really deep comparisons!
	var expected = {x1: x1, y1: y1, x2: x2, y2: y2};
	var actual = goog.object.clone(grid.drag);
	goog.object.remove(actual, 'origin');
	assertObjectEquals(message, expected, actual);
	var scroll = grid.scrollOffset_;
	
	// check that row and column CSS classes match expectations
	for (var y = 0; y < grid.getVisibleRowCount(); y++)
	{
		var rowElement = grid.rows_[y].getRowElement();
		var dataRow = y + scroll.y;
		var shouldBeVisible = (dataRow < grid.dataSource_.getCount());
		
		assertEquals(message + ": wrong visible status for " +
			"grid row " + y + ", data row " + dataRow,
			shouldBeVisible, goog.style.isElementShown(rowElement));
		
		if (shouldBeVisible)
		{
			assertEquals(message + ": wrong highlight status for " +
				"grid row " + y + ", data row " + dataRow,
				/* should this row be highlighted? */
				dataRow >= Math.min(y1, y2) &&
				dataRow <= Math.max(y1, y2),
				/* is it actually highlighted? */
				goog.dom.classes.has(rowElement, 'highlight'));
		}		
	}

	var builder = new goog.string.StringBuffer();
	for (var x = Math.min(x1, x2); x <= Math.max(x1, x2) && x1 >= 0; x++)
	{
		builder.append('table#' + grid.dataTable_.id + ' > ' +
			'tr.highlight > td.col_' + x + ' { background: #ddf; }');
	}
	assertEquals(message, builder.toString(), grid.highlightStyles_.innerHTML);
}

function testGridHighlightModeCells()
{
	var grid = initGrid(ds);
	
	com.qwirx.test.FakeBrowserEvent.mouseMove(grid.getCell(0, 0).tableCell);
	assertSelection(grid, 'Selection should not have changed without click',
		-1, -1, -1, -1);

	com.qwirx.test.FakeBrowserEvent.mouseDown(grid.getCell(0, 0).tableCell);
	assertSelection(grid, 'Selection should have changed with click',
		0, 0, 0, 0);
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	assertEquals(true, grid.isAllowTextSelection());
	assertEquals("mousedown should have set current row", 0,
		grid.getCursor().getPosition());
		
	// MOUSEOUT on a different cell is spurious and doesn't change mode
	com.qwirx.test.FakeBrowserEvent.mouseOut(grid.getCell(1, 0).tableCell);
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	assertEquals(true, grid.isAllowTextSelection());
	
	com.qwirx.test.FakeBrowserEvent.mouseOut(grid.getCell(0, 1).tableCell);
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	assertEquals(true, grid.isAllowTextSelection());
	assertEquals("Original cell should still be editable",
		"true", grid.getCell(0, 0).tableCell.contentEditable);

	// simulate MOUSEOUT to change the drag mode from TEXT to CELLS
	// this is the original starting cell, and leaving it does change mode
	com.qwirx.test.FakeBrowserEvent.mouseOut(grid.getCell(0, 0).tableCell);
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);
	assertEquals(false, grid.isAllowTextSelection());
	assertEquals("Original cell should no longer be editable",
		"inherit", grid.getCell(0, 0).tableCell.contentEditable);

	// entry into another cell has no effect
	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(1, 1).tableCell);
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);
	assertEquals(false, grid.isAllowTextSelection());
	
	// re-entry into starting cell switches mode back to TEXT
	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(0, 0).tableCell);
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	assertEquals(true, grid.isAllowTextSelection());
	assertEquals("Original cell should be editable again",
		"true", grid.getCell(0, 0).tableCell.contentEditable);

	// re-exit from starting cell switches mode back to CELLS
	com.qwirx.test.FakeBrowserEvent.mouseOut(grid.getCell(0, 0).tableCell);
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);
	assertEquals(false, grid.isAllowTextSelection());
	assertEquals("Original cell should no longer be editable",
		"inherit", grid.getCell(0, 0).tableCell.contentEditable);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(0, 1).tableCell);
	assertSelection(grid, 'Selection should have changed with drag',
		0, 0, 0, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(1, 0).tableCell);
	assertSelection(grid, 'Selection should have changed with drag',
		0, 0, 1, 0);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(0, 0).tableCell);
	assertSelection(grid, 'Selection should have changed with reentry to ' +
		'starting cell', 0, 0, 0, 0);

	// that will have switched the mode back to TEXT, and only
	// a mouseout will change it back
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	com.qwirx.test.FakeBrowserEvent.mouseOut(grid.getCell(0, 0).tableCell);
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(1, 1).tableCell);
	assertSelection(grid, 'Selection should have changed with drag',
		0, 0, 1, 1);

	// mouseup should enable text selection, even if it wasn't
	// enabled before, to allow keyboard selection afterwards
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);
	assertEquals(false, grid.isAllowTextSelection());
	com.qwirx.test.FakeBrowserEvent.mouseUp(grid.getCell(0, 0).tableCell);
	assertEquals(true, grid.isAllowTextSelection());
	// and set the selection mode back to NONE, so that future
	// mouse movement events don't cause selection changes
	assertEquals(com.qwirx.grid.Grid.DragMode.NONE, grid.dragMode_);
	// selection changes with mouseover, not mouseup
	assertSelection(grid, 'Selection should not have changed with mouseup',
		0, 0, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(2, 1).tableCell);
	assertSelection(grid, 'Selection should not have changed without another mousedown',
		0, 0, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseDown(grid.getCell(2, 1).tableCell);
	assertSelection(grid, 'Selection should have changed with click',
		2, 1, 2, 1);
	assertEquals("mousedown should have set current row", 1,
		grid.getCursor().getPosition());

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(1, 1).tableCell);
	assertSelection(grid, 'Selection should have changed with drag',
		2, 1, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(1, 0).tableCell);
	assertSelection(grid, 'Selection should have changed with drag',
		2, 1, 1, 0);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(1, 1).tableCell);
	assertSelection(grid, 'Selection should have changed with drag',
		2, 1, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOut(grid.getCell(0, 1).tableCell);
	assertSelection(grid, 'Selection should not have changed when mouse ' +
		'left the grid', 2, 1, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(0, 1).tableCell);
	assertSelection(grid, 'Selection should still be changeable after mouse ' +
		'left the grid and reentered in a different place',
		2, 1, 0, 1);

	com.qwirx.test.FakeBrowserEvent.mouseUp(grid.getCell(0, 0).tableCell);
	assertSelection(grid, 'Selection should not have changed with mouseup',
		2, 1, 0, 1);
}

function testGridLoadsDataFromDataSource()
{
	var grid = initGrid(ds);
	var columns = ds.getColumns();
	var expected = [];
	
	for (var r = 0; r < ds.getCount(); r++)
	{
		var expected_row = [];
		var item = ds.get(r);
		
		for (var c = 0; c < columns.length; c++)
		{
			var col_name = columns[c].name;
			var data = item[col_name];
			expected_row.push({value: data});
		}
		
		expected.push(expected_row);
	}
	
	assertGridContents(grid, expected);
}

function testGridHighlightModeColumns()
{
	var grid = initGrid(ds);
	
	var y_max = ds.getCount() - 1;

	// test that the header row doesn't become editable when clicked,
	// that text selection is disabled, and the entire column is
	// highlighted.
	com.qwirx.test.FakeBrowserEvent.mouseDown(grid.columns_[1].getIdentityNode());
	assertEquals(com.qwirx.grid.Grid.DragMode.COLUMNS,
		grid.dragMode_);
	assertSelection(grid, 'Selection should have changed with ' +
		'mousedown on header', 1, 0, 1, y_max);
	assertEquals("Header node should never allow text selection",
		false, grid.isAllowTextSelection());
	assertEquals("Header node should never be editable",
		"inherit", grid.columns_[1].getIdentityNode().contentEditable);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.columns_[2].getIdentityNode());
	assertSelection(grid, 'Selection should have changed with ' +
		'mouseover on header', 1, 0, 2, y_max);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(0, 0).tableCell);
	assertSelection(grid, 'Selection should have changed with ' +
		'mouseover on body', 1, 0, 0, y_max);

	com.qwirx.test.FakeBrowserEvent.mouseUp(grid.getCell(2, 0).tableCell);
	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(2, 1).tableCell);
	assertSelection(grid, 'Selection should not have changed with ' +
		'mouseover on body after mouseup', 1, 0, 0, y_max);
}

function testGridHighlightModeRows()
{
	var tds = new TestDataSource();
	var grid = initGrid(tds);
	
	var x_max = tds.getColumns().length - 1;
	assertEquals("cursor position should be at BOF initially",
		com.qwirx.data.Cursor.BOF, grid.getCursor().getPosition());
	
	// test that the header row doesn't become editable when clicked,
	// that text selection is disabled, and the entire column is
	// highlighted.
	tds.requestedRows = [];
	com.qwirx.test.FakeBrowserEvent.mouseDown(grid.rows_[0].getIdentityNode());
	assertEquals(com.qwirx.grid.Grid.DragMode.ROWS,
		grid.dragMode_);
	assertSelection(grid, 'Selection should have changed with ' +
		'mousedown on header', 0, 0, x_max, 0);
	assertEquals("Header node should never allow text selection",
		false, grid.isAllowTextSelection());
	assertEquals("Header node should never be editable",
		"inherit", grid.rows_[0].getIdentityNode().contentEditable);
	assertEquals("mousedown should have changed current row from BOF to 0", 0,
		grid.getCursor().getPosition());
	// TODO for efficiency it should really not reload anything
	/*
	assertObjectEquals("Change of cursor position should have loaded the " +
		"new current row", [grid.getCursor().getPosition()],
		tds.requestedRows);
	*/
	// Doing the same thing again should not load any rows, as it doesn't
	// result in a change of cursor position.
	com.qwirx.test.FakeBrowserEvent.mouseUp(grid.rows_[0].getIdentityNode());
	tds.requestedRows = [];
	com.qwirx.test.FakeBrowserEvent.mouseDown(grid.rows_[0].getIdentityNode());
	assertEquals("cursor should still be at position 0", 0,
		grid.getCursor().getPosition());
	assertObjectEquals("cursor position did not change, so no rows should " +
		"have been loaded", [], tds.requestedRows);
	
	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.rows_[1].getIdentityNode());
	assertSelection(grid, 'Selection should have changed with ' +
		'mouseover on header', 0, 0, x_max, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(0, 0).tableCell);
	assertSelection(grid, 'Selection should have changed with ' +
		'mouseover on body', 0, 0, x_max, 0);

	com.qwirx.test.FakeBrowserEvent.mouseUp(grid.getCell(1, 0).tableCell);
	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.getCell(1, 1).tableCell);
	assertSelection(grid, 'Selection should not have changed with ' +
		'mouseover on body after mouseup', 0, 0, x_max, 0);
}

function testGridInsertRowAt()
{
	var grid = initGrid(ds);
	
	var oldCount = ds.getCount();
	assertEquals('Grid should have been populated with some data',
		oldCount, grid.getVisibleRowCount());
	
	var oldRow0 = ds.get(0);
	var oldRow1 = ds.get(1);
	
	// insert a row between two others
	ds.insert(1, 
		{product: 'beer',
			strength: 'Refreshing, makes life more interesting/bearable',
			weakness: 'Fattening as hell'});
	assertEquals('Data source row count should have been updated',
		oldCount + 1, grid.getDatasource().getCount());
	
	function assertCellContentsAndSelection(rowIndex, contents)
	{
		assertEquals("Wrong contents in grid cell ("+rowIndex+",0)",
			contents, grid.getCell(0, rowIndex).text);
		assertEquals(rowIndex, grid.rows_[rowIndex].getRowIndex());
		var cell = grid.getCell(0, rowIndex).tableCell;
		assertEquals(rowIndex,
			cell[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW].getRowIndex());
		com.qwirx.test.FakeBrowserEvent.mouseDown(cell);
		assertSelection(grid, 'Selection should have changed with mousedown',
			0, rowIndex, 0, rowIndex);
		assertEquals("mousedown should have set current row", rowIndex,
			grid.getCursor().getPosition());
	}
	
	assertCellContentsAndSelection(0, oldRow0.product);
	assertCellContentsAndSelection(1, "beer");
	assertCellContentsAndSelection(2, oldRow1.product);
}

function assertGridContents(grid, data)
{
	self.assertEquals('Wrong number of rows in grid',
		data.length, grid.getVisibleRowCount());

	for (var rowIndex = 0; rowIndex < data.length; rowIndex++)
	{
		var rowData = data[rowIndex];
		for (var colIndex = 0; colIndex < rowData.length; colIndex++)
		{
			var cell = grid.rows_[rowIndex].getColumns()[colIndex].tableCell;
			self.assertEquals('Wrong value for row ' + rowIndex +
				' column ' + colIndex,
				rowData[colIndex].value.toString(), cell.innerHTML);
		}
	}
}

function testGridDataSourceEvents()
{
	var grid = initGrid(ds);

	assertGridContents(grid, data);
	
	data.push({id: 7, firstname: 'Paul'});
	ds.add(data[data.length-1]);
	assertGridContents(grid, data);
	
	data.splice(1, 0, {id: 8, firstname: 'Duke'});
	ds.insert(1, data[data.length-1]);
	assertGridContents(grid, data);
	
	var oldValue = data[1][1];
	data[1].firstname = 'Atreides';
	self.assertNotEquals('The data source should contain a ' +
		'deep copy of the data, not affected by external changed',
		'Atreides', ds.get(1).firstname);

	data[1].firstname = 'Leto';
	self.assertNotEquals('The data source should contain a ' +
		'deep copy of the data, not affected by external changed',
		'Leto', ds.get(1).firstname);
	data[1].firstname = oldValue;
	
	var iago = {id: 9, firstname: 'Iago'};
	ds.replace(2, iago);
	data.splice(2, 1, iago);
	assertGridContents(grid, data);
}	

var TestDataSource = function()
{
	this.requestedRows = [];
	this.rowCount = 10000;
};

goog.inherits(TestDataSource, com.qwirx.data.Datasource);

// http://station.woj.com/2010/02/javascript-random-seed.html
function random(max, seed)
{
	if (!seed)
	{
		seed = new Date().getTime();
	}
	seed = (seed*9301+49297) % 233280;
	return seed % max;
}

TestDataSource.prototype.get = function(rowIndex)
{
	this.requestedRows.push(rowIndex);
	return [
		{value: "" + rowIndex},
		{value: "" + random(1000, rowIndex)}
	];
};

TestDataSource.prototype.getCount = function()
{
	return this.rowCount;
};

TestDataSource.prototype.setRowCount = function(newRowCount)
{
	this.rowCount = newRowCount;
	this.dispatchEvent(com.qwirx.data.Datasource.Events.ROW_COUNT_CHANGE);
};

TestDataSource.prototype.getColumns = function()
{
	return [{caption: 'Row Index'}, {caption: 'Random Number'}];
};

function testGridDataSource()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);

	assertEquals(ds, grid.getDatasource());
	assertEquals(ds, grid.getCursor().dataSource_);
}

function assertGridRowsVisible(grid, numRows)
{
	var len = grid.rows_.length;
	
	for (var i = 0; i < len; i++)
	{
		var visible = (i < numRows);
		assertEquals("Display style is wrong for row " + i +
			" with " + numRows + " total rows", visible ? '' : 'none',
			grid.rows_[i].getRowElement().style.display);
	}
}

function testGridRespondsToDataSourceRowCountChanges()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);

	ds.setRowCount(1);
	assertEquals(0, grid.scrollBar_.getMaximum());
	assertObjectEquals({}, grid.drag);
	assertTrue("The following tests will fail unless at least " +
		"one row is visible",
		ds.getCount() < grid.getVisibleRowCount());
	assertEquals(0, grid.scrollBar_.getMaximum());
	assertEquals(0, grid.scrollOffset_.x);
	assertEquals(0, grid.scrollOffset_.y);
	assertGridRowsVisible(grid, 1);

	ds.setRowCount(grid.getFullyVisibleRowCount() + 1);
	assertEquals("Grid with datasource with 1 row more available " +
		"than visible should allow scrolling by 1 row", 1,
		grid.scrollBar_.getMaximum());
	assertEquals("Grid after datasource row count change should " +
		"still be positioned at left column", 0, grid.scrollOffset_.x);
	assertEquals("Grid after datasource row count change should " +
		"still be positioned at top row", 0, grid.scrollOffset_.y);
	// Slider is inverted, so 0 is at the bottom, and in this case
	// 1 is at the top.
	assertEquals("After datasource row count change, grid scrollbar " +
		"value should have been adjusted to maintain offset from bottom",
		1, grid.scrollBar_.getValue());
	assertGridRowsVisible(grid, grid.getVisibleRowCount());
	
	grid.scrollBar_.setValue(0); // scrolled down by 1 row
	assertEquals("Change to vertical scrollbar value should not have " +
		"changed horizonal scroll offset", 0, grid.scrollOffset_.x);
	assertEquals("Change to vertical scrollbar value should have " +
		"changed vertical scroll offset from bottom", 1,
		grid.scrollOffset_.y);
	assertGridRowsVisible(grid, grid.getFullyVisibleRowCount());

	// Changing datasource row count so that grid has fewer rows
	// should not change position.
	ds.setRowCount(grid.getFullyVisibleRowCount());
	assertEquals(0, grid.scrollBar_.getMaximum());
	assertEquals(0, grid.scrollOffset_.x);
	assertEquals(1, grid.scrollOffset_.y);
	// Slider is inverted, so 0 is at the bottom.
	assertEquals("The vertical scrollbar should be out of sync " +
		"with the grid contents, because the original scroll " +
		"position is no longer valid", 0, grid.scrollBar_.getValue());
	assertGridRowsVisible(grid, grid.getFullyVisibleRowCount() - 1);

	// Same with just one row visible.
	ds.setRowCount(grid.scrollOffset_.y + 1);
	assertEquals(1, grid.scrollOffset_.y);
	// Slider is inverted, so 0 is at the bottom.
	assertEquals("The vertical scrollbar should still be out of sync " +
		"with the grid contents", 0, grid.scrollBar_.getValue());
	assertGridRowsVisible(grid, 1);

	// Changing datasource row count so that no rows are visible
	// should however change position to keep at least one visible.
	ds.setRowCount(1);
	assertEquals(0, grid.scrollBar_.getMaximum());
	assertEquals(0, grid.scrollOffset_.x);
	assertEquals("Changing datasource row count so that no rows " +
		"are visible should have changed scroll position to keep " +
		"at least one row visible.", 0, grid.scrollOffset_.y);
	// Slider is inverted, so 0 is at the bottom.
	assertEquals("The vertical scrollbar should not be out of sync " +
		"with the grid contents any more", 0, grid.scrollBar_.getValue());
	assertGridRowsVisible(grid, 1);
}

/**
 * This test currently fails due to a bug in Closure, and is
 * therefore disabled:
 * {@see http://code.google.com/p/closure-library/issues/detail?id=521}
 */
/*
function testScrollBarBehaviour()
{
	var scroll = new goog.ui.Slider;
	scroll.setMaximum(10000);
	scroll.setValue(9998);
	assertEquals(0, scroll.getExtent());
	scroll.setMaximum(10);
	scroll.setValue(8);
	assertEquals(8, scroll.getValue());
	assertEquals(0, scroll.getExtent());
}
*/

function testGridScrollAndHighlight()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);
	
	function range(a, b)
	{
		var array = [];
		for (var i = 0; i <= (b - a); i++)
		{
			array[i] = a + i;
		}
		return array;
	}
	
	var gridRows = grid.getVisibleRowCount();
	assertObjectEquals(range(0, gridRows - 1), ds.requestedRows);
	
	var maxScroll = ds.getCount() - gridRows + 1;

	var scrollbar = grid.scrollBar_;
	assertNotNull(scrollbar);
	assertEquals('scrollbar has wrong minimum value', 0,
		scrollbar.getMinimum());
	assertEquals('scrollbar has wrong maximum value', maxScroll,
		scrollbar.getMaximum());
	// slider is inverted, so the maximum value is at the top
	assertEquals('scrollbar should be at maximum value (top)',
		scrollbar.getMaximum(), scrollbar.getValue());
	assertEquals(0, scrollbar.getExtent());

	ds.requestedRows = [];
	scrollbar.setValue(0); // slider is inverted, so 0 is at the bottom
	assertObjectEquals({x: 0, y: maxScroll},
		grid.scrollOffset_);
	assertObjectEquals(range(maxScroll,	ds.getCount() - 1),
		ds.requestedRows);
	
	grid.setSelection(1, 1, 2, 4);
	assertSelection(grid, "setSelection method should change selection",
		1, 1, 2, 4);

	ds.requestedRows = [];
	scrollbar.setValue(maxScroll - 2); // 2 from the top
	assertObjectEquals('wrong set of rows were loaded from datasource',
		range(2, gridRows + 1), ds.requestedRows);
	assertObjectEquals({x: 0, y: 2}, grid.scrollOffset_);
	assertSelection(grid, "scrolling should not have changed selection",
		1, 1, 2, 4);

	// Shrink the row count a bit, check that scrollbar is adjusted
	grid.setSelection(1, 1, 2, 4);
	ds.requestedRows = [];
	ds.setRowCount(gridRows * 2); // but the first two are offscreen
	maxScroll = ds.getCount() - grid.getFullyVisibleRowCount();
	assertEquals("row count change should have reset scrollbar maximum",
		maxScroll, scrollbar.getMaximum());
	assertEquals("row count change should have adjusted scrollbar " +
		"value to maintain position 2 rows down from the top",
		scrollbar.getMaximum() - 2, scrollbar.getValue());
	assertObjectEquals(range(2, gridRows + 1), ds.requestedRows);
	assertObjectEquals({x: 0, y: 2}, grid.scrollOffset_);
		
	// Shrink the row count to less than the selection, check that
	// scrollbar is adjusted (maximum should be 0) and selection
	// truncated to new row count.
	grid.setSelection(1, 1, 2, gridRows + 2);
	ds.requestedRows = [];
	
	// Test that setting datasource rows to fewer than visible rows
	// disables scrolling. It must be fewer, because the last row
	// may be only partially visible, so you might have to scroll
	// to see it.
	ds.setRowCount(gridRows - 1); // but the first two are offscreen
	assertEquals("row count change should have reset scrollbar " +
		"maximum to zero, as scrolling is no longer possible",
		0, scrollbar.getMaximum());
	assertEquals("row count change should have adjusted scrollbar " +
		"value to 0 to stay between minimum and maximum",
		0, scrollbar.getValue());
	assertSelection(grid, "shrinking datasource should have shrunk " +
		"selection", 1, 1, 2, gridRows - 2);
	
	// the grid scroll offset is left at 2, no longer matching the
	// scroll position, to avoid a visual jump
	assertObjectEquals({x: 0, y: 2}, grid.scrollOffset_);
	assertObjectEquals(range(2, gridRows - 2), ds.requestedRows);
	
	// but any attempt to set the value should cause the grid's
	// scroll offset to jump back to 0
	ds.requestedRows = [];
	grid.scrollBar_.dispatchEvent(goog.ui.Component.EventType.CHANGE);
	assertObjectEquals({x: 0, y: 0}, grid.scrollOffset_);
	assertObjectEquals(range(0, gridRows - 2), ds.requestedRows);	

	// reset for manual testing, playing and demos
	var dataRows = 10000;
	ds.setRowCount(dataRows);
	maxScroll = dataRows - grid.getFullyVisibleRowCount();
	
	// highlight the last row, scroll back to the top and simulate
	// a click. This used to try to unhighlight an HTML table row
	// element with a massive index, because scroll was not taken
	// into account.
	grid.setSelection(0, dataRows - 1, 1, dataRows - 1);

	assertEquals(maxScroll, scrollbar.getMaximum());
	scrollbar.setValue(maxScroll); // at the top
	assertEquals(maxScroll, scrollbar.getValue());
	
	var cell = grid.rows_[0].getColumns()[0].tableCell;
	assertEquals(0,
		cell[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW].getRowIndex());
	com.qwirx.test.FakeBrowserEvent.mouseDown(cell);
	assertSelection(grid, 'Selection should have changed with mousedown',
		0, 0, 0, 0);
	assertEquals("mousedown should have set current row", 0,
		grid.getCursor().getPosition());
}

function assertNavigateGrid(grid, startPosition, button,
	expectedPosition, expectedScroll, positionMessage, scrollMessage)
{
	grid.nav_.getCursor().setPosition(startPosition);
	assertEquals("starting position row number in Cursor",
		startPosition, grid.nav_.getCursor().getPosition());
	assertEquals("starting position text field contents",
		startPosition + "", grid.nav_.rowNumberField_.getValue());
	
	if (!scrollMessage)
	{
		var initialScroll = grid.scrollOffset_.y;
		if (initialScroll != expectedScroll)
		{
			scrollMessage = "selecting an offscreen record should " +
				"scroll until record is in view";
		}
		else
		{
			scrollMessage = "selecting an onscreen record should " +
				"not scroll";
		}
	}
	
	com.qwirx.test.FakeClickEvent.send(button);
	assertEquals(positionMessage, expectedPosition,
		grid.nav_.getCursor().getPosition());
	assertEquals(scrollMessage, expectedScroll, grid.scrollOffset_.y);
	assertEquals("final scroll bar position",
		grid.scrollBar_.getMaximum() - expectedScroll,
		grid.scrollBar_.getValue());

	// Check that the row highlighter has been updated
	var currentDataRowIndex = expectedPosition;
	var currentVisibleRowIndex = currentDataRowIndex - expectedScroll;
	var css;
	
	if (currentVisibleRowIndex >= 0 && 
		currentVisibleRowIndex < grid.rows_.length)
	{
		css = 'table#' + grid.dataTable_.id +
			' > tr#row_' + currentVisibleRowIndex + 
			' > th { background-color: #88f; }';
	}
	else
	{
		css = "";
	}	

	assertEquals(css, grid.currentRowStyle_.textContent);
}

/**
 * It's not enough for the grid navigation buttons to listen for
 * onClick events; they must also intercept mouse events to avoid
 * them being sent to the grid, where they will cause all kinds of
 * trouble.
 */
function testGridNavigationButtonsInterceptMouseEvents()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);

	var buttons = [false, // included to ensure initial conditions
		grid.nav_.firstButton_,
		grid.nav_.prevPageButton_,
		grid.nav_.prevButton_,
		grid.nav_.nextButton_,
		grid.nav_.nextPageButton_,
		grid.nav_.lastButton_];

	// Patch the grid control to intercept mouseDown and mouseUp
	// events, which should be intercepted before they reach it.
	function f(e)
	{
		fail(e.type + " event propagation should be stopped " +
			"before reaching the Grid");
	}
	
	var handler = grid.getHandler();
	var element = grid.getElement();
	handler.listen(element, goog.events.EventType.MOUSEDOWN, f);
	handler.listen(element, goog.events.EventType.MOUSEUP, f);
	
	for (var i = 0; i < buttons.length; i++)
	{
		var button = buttons[i];
		
		if (button == false)
		{
			// test initial conditions
		}
		else
		{
			var event = com.qwirx.test.assertEvent(button,
				com.qwirx.util.ExceptionEvent.EVENT_TYPE,
				function()
				{
					com.qwirx.test.FakeClickEvent.send(button);
				},
				"The grid navigation button did not intercept the event",
				true /* opt_continue_if_exception_not_thrown */);
			
			// If an event was thrown at all, it must be an ExceptionEvent
			// and contain the right kind of exception.
			if (event)
			{
				var exception = event.getException();
				goog.asserts.assertInstanceof(exception,
					com.qwirx.data.IllegalMove);
			}
		}
		
		var buttonName = (button ? button.getContent() : "no");
		assertSelection(grid, "should be no selection",
			-1, -1, -1, -1);
		// MOUSEUP does actually trigger an action, so it will
		// move the cursor, so we can't test this:
		/*
		assertEquals("cursor should not have moved on " +
			buttonName + " button click", com.qwirx.data.Cursor.BOF,
			grid.getCursor().getPosition());
		assertEquals("grid should not have scrolled on " +
			buttonName + " button click", 0, grid.scrollOffset_.y);
		*/
	}
}

function assertNavigationException(grid, startPosition, button, message)
{
	grid.nav_.getCursor().setPosition(startPosition);
	assertEquals(startPosition, grid.nav_.getCursor().getPosition());
	// Browser event handlers should NOT throw exceptions, because
	// nothing can intercept them and handle them properly. They should
	// throw a {@link com.qwirx.util.ExceptionEvent} at themselves
	// instead.
	com.qwirx.test.assertEvent(button, com.qwirx.util.ExceptionEvent.EVENT_TYPE,
		function() { com.qwirx.test.FakeClickEvent.send(button); },
		message);
}

function testGridNavigation()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);

	var BOF = com.qwirx.data.Cursor.BOF;
	var EOF = com.qwirx.data.Cursor.EOF;
	var dataRows = ds.getCount();
	var gridRows = grid.getFullyVisibleRowCount();
	var maxScroll = dataRows - gridRows;
	var lastRecord = dataRows - 1;
	
	assertTrue("we will scroll unexpectedly if gridRows < 3, " +
		"breaking the tests", gridRows >= 3);
	/*
	assertFalse("toolbar should not be focusable, so it doesn't " +
		"steal focus from its buttons on bubble up",
		goog.dom.isFocusableTabIndex(grid.nav_.getElement()));
	*/

	assertEquals("cursor should be positioned at BOF initially",
		BOF, grid.nav_.getCursor().getPosition());

	// movements from BOF
	assertNavigateGrid(grid, BOF, grid.nav_.nextButton_, 0, 0,
		"next record from BOF");
	assertNavigateGrid(grid, BOF, grid.nav_.nextPageButton_, gridRows - 1,
		0, "next page from BOF takes us one less than a pageful down");
	assertNavigateGrid(grid, BOF, grid.nav_.lastButton_, lastRecord,
		maxScroll, "last record from BOF");
	assertNavigationException(grid, BOF, grid.nav_.prevButton_,
		"previous record from BOF should throw exception");
	assertNavigationException(grid, BOF, grid.nav_.prevPageButton_,
		"previous record from BOF should throw exception");
	assertNavigateGrid(grid, BOF, grid.nav_.firstButton_, 0, 0,
		"first record from BOF");

	// movements from record 0
	assertNavigateGrid(grid, 0, grid.nav_.nextButton_, 1, 0,
		"next record from 0");
	assertNavigateGrid(grid, 0, grid.nav_.nextPageButton_, gridRows,
		1, "next page from 0", "moving the selection down by a " +
		"pageful, and keeping the currently selected row visible, " +
		"requires the grid to scroll down by 1 row.");
	assertNavigateGrid(grid, 0, grid.nav_.lastButton_, lastRecord,
		maxScroll, "last record from 0");
	assertNavigateGrid(grid, 0, grid.nav_.prevButton_, BOF, 0,
		"previous record from 0");
	assertNavigateGrid(grid, 0, grid.nav_.prevPageButton_, BOF, 0,
		"previous page from 0");
	assertNavigateGrid(grid, 0, grid.nav_.firstButton_, 0, 0,
		"first record from 0");

	// movements from record 1
	assertNavigateGrid(grid, 1, grid.nav_.nextButton_, 2, 0,
		"next record from 1");
	assertNavigateGrid(grid, 1, grid.nav_.nextPageButton_, gridRows + 1,
		2, "next page from 0", "moving the selection down by a " +
		"pageful, and keeping the currently selected row visible, " +
		"requires the grid to scroll down by 2 rows.");
	assertNavigateGrid(grid, 1, grid.nav_.lastButton_, lastRecord,
		maxScroll, "last record from 1");
	assertNavigateGrid(grid, 1, grid.nav_.prevButton_, 0, 0,
		"previous record from 1");
	assertNavigateGrid(grid, 1, grid.nav_.prevPageButton_, BOF, 0,
		"previous page from 1");
	assertNavigateGrid(grid, 1, grid.nav_.firstButton_, 0, 0,
		"first record from 1");
		
	// Movements from record gridRows-1 (second page of rows)
	grid.setScroll(0, gridRows-1);
	assertNavigateGrid(grid, gridRows-1, grid.nav_.prevPageButton_,
		BOF, 0, "previous page from gridRows-1");

	// Movements from record lastRecord-gridRows+1
	grid.setScroll(0, lastRecord-gridRows);
	assertNavigateGrid(grid, lastRecord-gridRows+1,
		grid.nav_.nextPageButton_, EOF, lastRecord-gridRows+1,
		"next page from lastRecord-gridRows+1");

	// movements from record lastRecord-1
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.nextButton_,
		lastRecord, maxScroll,
		"next record from lastRecord-1");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.nextPageButton_,
		EOF, maxScroll, "next page from lastRecord-1");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.lastButton_,
		lastRecord, maxScroll, "last record from lastRecord-1");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.prevButton_,
		lastRecord - 2, maxScroll, "previous record from lastRecord-1");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.prevPageButton_,
		lastRecord - gridRows - 1, maxScroll - 2,
		"previous page from lastRecord-1",
		"should have to scroll up 2 rows to display newly active row");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.firstButton_, 0, 0,
		"first record from lastRecord-1");

	// movements from record lastRecord
	assertNavigateGrid(grid, lastRecord, grid.nav_.nextButton_,
		EOF, maxScroll, "next record from lastRecord");
	assertNavigateGrid(grid, lastRecord, grid.nav_.nextPageButton_,
		EOF, maxScroll, "next page from lastRecord");
	assertNavigateGrid(grid, lastRecord, grid.nav_.lastButton_,
		lastRecord, maxScroll, "last record from lastRecord");
	assertNavigateGrid(grid, lastRecord, grid.nav_.prevButton_,
		lastRecord - 1, maxScroll, "previous record from lastRecord");
	assertNavigateGrid(grid, lastRecord, grid.nav_.prevPageButton_,
		lastRecord - gridRows, maxScroll - 1,
		"previous page from lastRecord",
		"should have to scroll up 1 row to display newly active row");
	assertNavigateGrid(grid, lastRecord, grid.nav_.firstButton_, 0, 0,
		"first record from lastRecord");

	// movements from EOF
	assertNavigationException(grid, EOF, grid.nav_.nextButton_,
		"next record from EOF");
	assertNavigationException(grid, EOF, grid.nav_.nextPageButton_,
		"next page from EOF");
	assertNavigateGrid(grid, EOF, grid.nav_.lastButton_,
		lastRecord, maxScroll, "last record from EOF");
	assertNavigateGrid(grid, EOF, grid.nav_.prevButton_,
		lastRecord, maxScroll, "previous record from EOF");
	assertNavigateGrid(grid, EOF, grid.nav_.prevPageButton_,
		lastRecord - gridRows + 1, maxScroll,
		"previous page from EOF",
		"should not have to scroll to display newly active row");
	assertNavigateGrid(grid, EOF, grid.nav_.firstButton_, 0, 0,
		"first record from EOF");
}

// TODO test that inserting and updating rows in the data source when
// the grid is scrolled works properly.

// TODO test that inserting a row in the middle of a selected area
// extends the selection by 1 row, or selects the same original rows
// but not the newly added one if/when we support split selections.
