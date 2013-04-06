goog.provide('com.qwirx.freebase.InstanceListView');

goog.require('com.qwirx.freebase.DocumentEditor');
goog.require('com.qwirx.grid.Grid');
goog.require('com.qwirx.grid.NavigationBar');

com.qwirx.freebase.FLASH_RENDERER = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-flash');

com.qwirx.freebase.InstanceListView = function(gui, freebase, document,
	editarea, opt_tabbar)
{
	com.qwirx.freebase.DocumentEditor.call(this, gui, freebase,
		document, editarea, opt_tabbar);

	var document = this.document_;
	var self = this;
	var editorControl = this.editorControl_;

	editorControl.className += ' fb-docedit-datagrid';
	
	var columnsGridInfo = [{name: '_id', caption: 'ID'}];
	var numCols = document.columns.length;
	for (var i = 0; i < numCols; i++)
	{
		columnsGridInfo[i + 1] = {name: document.columns[i].name,
			caption: document.columns[i].name};
	}
	
	var datasource = this.dataSource_ = 
		new com.qwirx.data.SimpleDatasource(columnsGridInfo, []);
	
	this.grid_ = new com.qwirx.grid.Grid(datasource);
	this.grid_.addClassName('fb-datagrid');
	this.grid_.render(editorControl);
	
	this.nav_ = new com.qwirx.grid.NavigationBar(this.grid_.getCursor());
	this.nav_.render(editorControl);

	this.freebase_.view(this.documentId_, 'all',
		function(all_results)
		{
			var numRows = all_results.rows.length;
			
			for (var r = 0; r < numRows; r++)
			{
				var result = all_results.rows[r].value;
				datasource.add(result);
			}
		});
};

goog.inherits(com.qwirx.freebase.InstanceListView,
	com.qwirx.freebase.DocumentEditor);

com.qwirx.freebase.InstanceListView.prototype.getDataGrid = function()
{
	return this.grid_;
};

com.qwirx.freebase.InstanceListView.prototype.getDataSource = function()
{
	return this.dataSource_;
};

/*
 * Converts a document (a model object) into the cell data that should
 * be displayed in the grid for this document.
 * @todo If still necessary, this should be an adaptor datasource
 * between this view and the {com.qwirx.grid.Grid}. Maybe when Grid
 * has a GridDataSource that will be easier.
 */
 /*
com.qwirx.freebase.InstanceListView.prototype.getGridColumnData =
	function(document, opt_numColumns)
{
	var model = this.document_;
	var numColumns = opt_numColumns || model.columns.length;
	var columnCells = [{value: document._id}];
	
	for (var c = 0; c < numColumns; c++)
	{
		var column = model.columns[c];
		var content = document[column.name];
		var value;
		
		if (column.type == "String")
		{
			if (content == undefined)
			{
				value = "(undefined)";
			}
			else
			{
				value = content;
			}
		}
		else if (column.type == "Number")
		{
			if (content == undefined)
			{
				value = "";
			}
			else
			{
				value = content.toString();
			}
		}
		else
		{
			if (content == undefined)
			{
				value = "(undefined " + column.type + ")";
			}
			else
			{
				value = content.toString();
			}
		}
		
		var cell = {value: value};
		columnCells[c + 1] = cell;
	}
	
	return columnCells;
};
*/

/**
 * Sort comparator which sorts records in a grid by their _id.
 */
com.qwirx.freebase.InstanceListView.prototype.gridRowIdCompare = function(a, b)
{
	var ta = a._id;
	var tb = b._id;
	return goog.array.defaultCompare(ta, tb);
};

/**
 * Event handler for global DocumentSaved events fired at the
 * database, which updates the grid if a document is modified or
 * created which the grid should display.
 */
com.qwirx.freebase.InstanceListView.prototype.onDocumentSaved = function(event)
{
	var document = event.getDocument();
	var gridDataSource = this.dataSource_;
	var rowIndex = gridDataSource.binarySearch(this.gridRowIdCompare,
		document);
	
	if (rowIndex >= 0)
	{
		gridDataSource.replace(rowIndex, document);
	}
	else
	{
		// row should not exist yet, so newRowIndex < 0
		rowIndex = ~rowIndex;
		gridDataSource.insert(rowIndex, document);
	}
};

