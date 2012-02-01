goog.provide('com.qwirx.freebase.CloseButton');
goog.provide('com.qwirx.freebase.ClosableTab');
goog.provide('com.qwirx.freebase.DocumentEditor');

goog.require('goog.ui.Control');
goog.require('goog.ui.CustomButton');
goog.require('com.qwirx.grid.Grid');

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

com.qwirx.freebase.FLASH_RENDERER = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-flash');

com.qwirx.freebase.DocumentEditor = function(gui, freebase, document,
	opt_tabbar, opt_editarea)
{
	this.gui_ = gui;
	this.freebase_ = freebase;
	this.document_ = document;
	this.documentId_ = (document ? document._id : null);
	this.editArea_ = opt_editarea;
	var self = this;

	// Register a DocumentSaved event listener to update ourselves
	// if necessary, whenever a document is modified.

	goog.events.listen(freebase,
		com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this);
	
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
			
			var grid = this.grid_ = new com.qwirx.grid.Grid(columnsGridInfo);
			grid.addClassName('fb-datagrid');
			grid.render(editorControl);
			
			freebase.view(this.documentId_, 'all',
				function(all_results)
				{
					var numRows = all_results.rows.length;
					
					for (var r = 0; r < numRows; r++)
					{
						var result = all_results.rows[r].value;
						var columnCells = self.getGridColumnData(result,
							numCols);
						var rowIndex = grid.appendRow(columnCells);
					}
				});
		}
		else
		{
			// auto-render something usable
			editorControl.className += ' fb-docedit-autoform';
			var controls = this.autoFormControls_ = {};
			this.autoFormFixedCells_ = {}

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
				this.createAutoFormRow_(fieldName);
			}
			
			var submit = this.submitButton_ = new goog.ui.CustomButton('Save');
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

com.qwirx.freebase.DocumentEditor.prototype.createAutoFormRow_ =
	function(fieldName)
{
	var document = this.document_;
	var editorControl = this.editorControl_;
	var table = this.autoFormTable_;
	var formControls = this.autoFormControls_;
	var inputAttribs = {value: document[fieldName]};
	var dom = goog.dom.getDomHelper();
	var tr;

	if (!document.hasOwnProperty(fieldName))
	{
		// ignore inherited properties such as methods
	}
	else if (fieldName.indexOf('_') == 0)
	{
		// create _id and _rev document attributes as
		// hidden fields
		inputAttribs.type = 'hidden';
		var input = formControls[fieldName] = dom.createDom('input',
			inputAttribs);
		editorControl.appendChild(input);
		
		tr = dom.createDom('tr', 'fb-row');

		var th = dom.createDom('th', 'fb-row-heading', fieldName);
		tr.appendChild(th);
	
		var td = this.autoFormFixedCells_[fieldName] = dom.createDom('td',
			'fb-row-value', document[fieldName]);
		tr.appendChild(td);
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
		var input = formControls[fieldName] =
			dom.createDom('input', inputAttribs);
		td.appendChild(input);
	}

	if (tr)
	{
		table.appendChild(tr);
	}				
};

com.qwirx.freebase.DocumentEditor.prototype.onSaveClicked = function(event)
{
	var controls = this.autoFormControls_;
	var columns = this.document_.constructor.columns;
	var l = columns.length;
	var columnsByName = {};
	
	for (var c = 0; c < l; c++)
	{
		var column = columns[c];
		columnsByName[column.name] = column;
	}
	
	var newDoc = this.document_ = goog.object.clone(this.document_);
	
	for (var i in controls)
	{
		var value = controls[i].value;
		var column = columnsByName[i];
		if (column)
		{
			if (column.type == 'Number')
			{
				value = Number(value);
			}
		}
		newDoc[i] = value;
	}
	
	newDoc = this.freebase_.instantiateModel_(newDoc);
	this.document_ = newDoc;
	
	var flash = this.autoFormFlash_;
	
	this.freebase_.save(newDoc,
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
	
	if (this.editArea_)
	{
		goog.dom.removeNode(this.editorControl_);
	}

	goog.events.unlisten(this.freebase_,
		com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this);
	
	if (this.gui_)
	{
		this.gui_.onDocumentClose(this);
	}
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

/**
 * Binary search on a sorted tree (actually any BaseNode) to find the
 * correct insertion point to maintain sort order.
 */
com.qwirx.freebase.DocumentEditor.prototype.gridRowIdSearch =
	function(grid, compareRowFn, target)
{
	return com.qwirx.freebase.binarySearch(
		function countFn()
		{
			return grid.getRowCount();
		},
		function compareFn(atIndex)
		{
			return compareRowFn(target, grid.getRow(atIndex).getColumns());
		});
};

com.qwirx.freebase.DocumentEditor.prototype.gridRowIdCompare = function(a, b)
{
	var ta = a[0].value;
	var tb = b[0].value;
	return goog.array.defaultCompare(ta, tb);
};

/**
 * Event handler for DocumentSaved events fired at the database, which
 * updates the grid if a document is modified or created which the
 * grid should display.
 */
com.qwirx.freebase.DocumentEditor.prototype.onDocumentSaved = function(event)
{
	var document = event.getDocument();
	var grid = this.grid_;
	
	if (grid)
	{
		var newRowData = this.getGridColumnData(document);
		var rowIndex = this.gridRowIdSearch(grid,
			this.gridRowIdCompare, newRowData);
		
		if (rowIndex >= 0)
		{
			grid.updateRow(rowIndex, newRowData);
		}
		else
		{
			// row should not exist yet, so newRowIndex < 0
			rowIndex = ~rowIndex;
			grid.insertRowAt(newRowData, rowIndex);
		}
	}

	var controls = this.autoFormControls_;
	
	if (controls)
	{
		this.document_ = document;
		
		for (var i in controls)
		{
			controls[i].value = document[i];
		}
		
		for (var i in this.autoFormFixedCells_)
		{
			this.autoFormFixedCells_[i].innerHTML =
				goog.string.htmlEscape(document[i]);
		}
	}
};
