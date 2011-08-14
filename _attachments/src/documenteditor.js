goog.provide('com.qwirx.freebase.CloseButton');
goog.provide('com.qwirx.freebase.ClosableTab');
goog.provide('com.qwirx.freebase.Grid');
goog.provide('com.qwirx.freebase.DocumentEditor');
goog.require('goog.ui.Control');
goog.require('goog.ui.CustomButton');

com.qwirx.freebase.CLOSE_BUTTON_RENDERER =
	goog.ui.ControlRenderer.getCustomRenderer(goog.ui.CustomButtonRenderer,
		'fb-tab-close-button');

com.qwirx.freebase.CloseButton = function(opt_renderer, opt_domHelper)
{
	var domHelper = opt_domHelper || goog.dom.getDomHelper();
	var closeIconElement = domHelper.createDom('span',
		'fb-tab-close-icon', '');
	goog.ui.CustomButton.call(this, closeIconElement,
		opt_renderer || com.qwirx.freebase.CLOSE_BUTTON_RENDERER,
		opt_domHelper);
	this.addClassName('fb-tab-close-button');
	// this.addClassName('ui-icon');
	// this.addClassName('ui-icon-close');
};
goog.inherits(com.qwirx.freebase.CloseButton, goog.ui.CustomButton);

/**
 * Override to prevent bubbling up of events, where the tab containing
 * the button then handles the mouse down event, stealing the focus,
 * which deactivates the button and defeats the action event on mouseup.
 */
com.qwirx.freebase.CloseButton.prototype.handleMouseDown = function(e)
{
	com.qwirx.freebase.CloseButton.superClass_.handleMouseDown.call(this, e);
	e.stopPropagation();
};

com.qwirx.freebase.ClosableTab = function(caption)
{
	goog.ui.Tab.call(this, caption);
	/*
	var closeDom = this.getDomHelper().createDom('span',
		'fb-tab-closebox ui-icon ui-icon-close', '');
	var closeButton = new goog.ui.Button(closeDom);
	this.addChild(closeButton);
	*/
};

goog.inherits(com.qwirx.freebase.ClosableTab, goog.ui.Tab);

com.qwirx.freebase.ClosableTab.prototype.createDom = function(tab)
{
	var self = this;
	var element = com.qwirx.freebase.ClosableTab.superClass_.createDom.call(this, tab);
	var closeButton = new com.qwirx.freebase.CloseButton();
	closeButton.render(this.getElement());
	
	goog.events.listen(closeButton, goog.ui.Component.EventType.ACTION,
		this.close, false, this);
        
	return element;
};

com.qwirx.freebase.ClosableTab.prototype.close = function()
{
	var closeEvent = new goog.events.Event(goog.ui.Component.EventType.CLOSE,
		this);
	return this.dispatchEvent(closeEvent);	
};

com.qwirx.freebase.Grid = function(columns, opt_renderer)
{
	opt_renderer = opt_renderer || com.qwirx.freebase.Grid.RENDERER;
	goog.ui.Control.call(this, null, opt_renderer);
	this.columns_ = columns.slice(0); // copy
	
	// focusing a grid isn't very useful and looks ugly in Chrome
	this.setSupportedState(goog.ui.Component.State.FOCUSED, false);
};

goog.inherits(com.qwirx.freebase.Grid, goog.ui.Control);

com.qwirx.freebase.Grid.RENDERER = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-grid');

com.qwirx.freebase.Grid.prototype.createDom = function()
{
	this.element_ = this.dom_.createDom('table',
		this.getRenderer().getClassNames(this).join(' '));

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
};

com.qwirx.freebase.Grid.prototype.addRow = function(columns)
{
	var numCols = columns.length;
	var cells = [];
	
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var td = column.tableCell = this.dom_.createDom('td', {},
			column.value);
		cells.push(td);
	}
	
	var newTableRow = this.dom_.createDom('tr', {}, cells);
	this.element_.appendChild(newTableRow);
	
	var newRowIndex = this.rowCount_;
	this.rowCount_++;
	this.rows_.push(columns);
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
}

com.qwirx.freebase.Grid.prototype.getRow = function(rowIndex)
{
	return this.rows_[rowIndex];
}

com.qwirx.freebase.FLASH_RENDERER = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-flash');

com.qwirx.freebase.DocumentEditor = function(gui, freebase, document,
	opt_tabbar, opt_editarea)
{
	this.gui_ = gui;
	this.freebase_ = freebase;
	this.document_ = document;
	this.documentId_ = (document ? document._id : null);
	var self = this;
	
	if (opt_editarea)
	{
		var editorControl = this.editorControl_ = goog.dom.createDom('div',
			'fb-edit-area-doc-div');
		
		opt_editarea.appendChild(editorControl);
		
		if (this.documentId_ && Freebase.isTableId(this.documentId_))
		{
			// show all records in the table
			editorControl.className += ' fb-docedit-datagrid';
			
			var columnsGridInfo = [{caption: 'ID'}];
			
			var numCols = document.columns.length;
			for (var i = 0; i < numCols; i++)
			{
				columnsGridInfo[i + 1] = {caption: document.columns[i].name};
			}
			
			var grid = this.grid_ = new com.qwirx.freebase.Grid(columnsGridInfo);
			grid.addClassName('fb-datagrid');
			grid.render(editorControl);
			
			// register a DocumentSaved event listener to update the grid
			// if a document shown in this grid is modified.
			goog.events.listen(freebase,
				com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
				this.onDocumentSaved, false, this);
				
			var rowMap = this.rowMap_ = {};
			
			freebase.view(this.documentId_, 'all',
				function(all_results)
				{
					var numRows = all_results.rows.length;
					
					for (var r = 0; r < numRows; r++)
					{
						var result = all_results.rows[r].value;
						var columnCells = self.getGridColumnData(result,
							numCols);
						var rowIndex = grid.addRow(columnCells);
						rowMap[result._id] = rowIndex;
					}
				});
		}
		else
		{
			// auto-render something usable
			editorControl.className += ' fb-docedit-autoform';
			var controls = this.autoFormControls_ = {};

			var dom = goog.dom.getDomHelper();
			
			var flash = this.autoFormFlash_ = new goog.ui.Control('',
				com.qwirx.freebase.FLASH_RENDERER, dom);
			flash.render(editorControl);
			flash.setVisible(false);
			
			var table = this.autoFormTable_ = dom.createDom('table',
				'fb-doc-auto');
			editorControl.appendChild(table);
			
			var fields = goog.object.getKeys(document).sort();
			var l = fields.length;
			
			for (var i = 0; i < l; i++)
			{
				var fieldName = fields[i];
				var inputAttribs = {value: document[fieldName]};
				var tr = undefined;
				
				if (!document.hasOwnProperty(fieldName))
				{
					// ignore inherited properties such as methods
				}
				else if (fieldName.indexOf('_') == 0)
				{
					// create _id and _rev document attributes as
					// hidden fields
					inputAttribs.type = 'hidden';
					var input = dom.createDom('input', inputAttribs);
					editorControl.appendChild(input);
					
					if (fieldName == '_id')
					{
						tr = dom.createDom('tr', 'fb-row');

						var th = dom.createDom('th', 'fb-row-heading',
							fieldName);
						tr.appendChild(th);
					
						var td = dom.createDom('td', 'fb-row-value',
							document[fieldName]);
						tr.appendChild(td);
					}
				}
				else if (fieldName.indexOf(com.qwirx.freebase.Freebase.INTERNAL_FIELD_PREFIX) == 0)
				{
					// ignore internal fields, don't allow changing them
				}
				else
				{
					tr = dom.createDom('tr', 'fb-row');

					/*					
					var column = undefined;
					var l = document.constructor.columns.length;
					for (var c = 0; c < l; c++)
					{
						if (document.constructor.columns[c].name == i)
						{
							column = document.constructor.columns[c];
						}
					}
					*/
					
					var th = dom.createDom('th', 'fb-row-heading', fieldName);
					tr.appendChild(th);
					
					var td = dom.createDom('td', 'fb-row-value');
					tr.appendChild(td);
					
					inputAttribs.type = 'text';
					var input = controls[fieldName] =
						dom.createDom('input', inputAttribs);
					td.appendChild(input);
				}

				if (tr)
				{
					table.appendChild(tr);
				}				
			}
			
			var submit = new goog.ui.CustomButton('Save');
			submit.render(editorControl);
			goog.events.listen(submit, goog.ui.Component.EventType.ACTION,
				this.onSaveClicked, false, this);
		} // table or document
	} // have edit area

	if (opt_tabbar)
	{
		this.tabBar_ = opt_tabbar;
		var title = this.documentId_ || "Untitled";
		var tab = this.tab_ = new com.qwirx.freebase.ClosableTab(title);
		tab.setModel(this);
		gui.editAreaDocTabs_.addChild(tab, true /* render now */);
		gui.editAreaDocTabs_.setSelectedTab(tab);
		
		goog.events.listen(tab, goog.ui.Component.EventType.SELECT,
			this.onTabSelect, false, this);
		goog.events.listen(tab, goog.ui.Component.EventType.UNSELECT,
			this.onTabUnselect, false, this);
		goog.events.listen(tab, goog.ui.Component.EventType.CLOSE,
			this.onTabClose, false, this);
	} // have tabbar
}; // DocumentEditarea() constructor

com.qwirx.freebase.DocumentEditor.EDIT_AREA_RENDERER =
	goog.ui.ControlRenderer.getCustomRenderer(goog.ui.ControlRenderer,
		'fb-edit-area-doc-div');

com.qwirx.freebase.DocumentEditor.prototype.onSaveClicked = function(event)
{
	var controls = this.autoFormControls_;
	
	for (var i in controls)
	{
		this.document_[i] = controls[i].value;
	}
	
	var flash = this.autoFormFlash_;
	
	this.freebase_.save(this.document_,
		function onSuccess(object)
		{
			flash.removeClassName('fb-error-flash');
			flash.addClassName('fb-success-flash');
			flash.setContent('Document saved.');
			flash.setVisible(true);
		},
		function onError(error)
		{
			flash.removeClassName('fb-success-flash');
			flash.addClassName('fb-error-flash');
			flash.setContent('Failed to save document: ' + error);
			flash.setVisible(true);
		});
};

com.qwirx.freebase.DocumentEditor.prototype.activate = function()
{
	if (this.tab_)
	{
		this.tabBar_.setSelectedTab(this.tab_);
	}
};

com.qwirx.freebase.DocumentEditor.prototype.onTabSelect = function(event)
{
	if (this.editorControl_)
	{
		goog.style.showElement(this.editorControl_, true);
	}
};

com.qwirx.freebase.DocumentEditor.prototype.onTabUnselect = function(event)
{
	if (this.editorControl_)
	{
		goog.style.showElement(this.editorControl_, false);
	}
};

com.qwirx.freebase.DocumentEditor.prototype.onTabClose = function(event)
{
	this.close();
};

com.qwirx.freebase.DocumentEditor.prototype.close = function()
{
	if (this.tab_)
	{
		this.tabBar_.removeChild(this.tab_, true);
	}
	
	if (this.gui_)
	{
		this.gui_.onDocumentClose(this);
	}
};

com.qwirx.freebase.DocumentEditor.prototype.getDocumentRowIndex =
	function(documentId)
{
	return this.rowMap_[documentId];
};

com.qwirx.freebase.DocumentEditor.prototype.getDataGrid = function()
{
	return this.grid_;
};

/**
 * Converts a document (a model object) into the cell data that should
 * be displayed in the grid for this document.
 */
com.qwirx.freebase.DocumentEditor.prototype.getGridColumnData =
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
				value = "" + content;
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

/**
 * Event handler for DocumentSaved events fired at the database, which
 * updates the grid if a document is modified or created which the
 * grid should display.
 */
com.qwirx.freebase.DocumentEditor.prototype.onDocumentSaved = function(event)
{
	var grid = this.grid_;
	
	if (grid)
	{
		var document = event.getDocument();
		var existingRowIndex = this.rowMap_[document._id];
		
		if (existingRowIndex)
		{
			grid.updateRow(existingRowIndex,
				this.getGridColumnData(document));
		}
		else
		{
			var newRowIndex = grid.addRow(this.getGridColumnData(document));
			this.rowMap_[document._id] = newRowIndex;
		}
	}
};

