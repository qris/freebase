goog.provide('com.qwirx.freebase.DocumentEditor');

goog.require('com.qwirx.grid.Grid');
goog.require('com.qwirx.data.SimpleDatasource');
goog.require('com.qwirx.freebase.ClosableTab');

com.qwirx.freebase.DocumentEditor = function(gui, freebase, document,
	editarea, opt_tabbar)
{
	this.gui_ = gui;
	this.freebase_ = freebase;
	this.document_ = document;
	this.documentId_ = (document ? document._id : null);
	this.editArea_ = editarea;
	var self = this;

	// Register a DocumentSaved event listener to update ourselves
	// if necessary, whenever a document is modified.

	goog.events.listen(freebase,
		com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this);
	
	var editorControl = this.editorControl_ = goog.dom.createDom('div',
		'fb-edit-area-doc-div');
	
	editarea.appendChild(editorControl);
	
	// Subclasses should fill the editorControl with some controls :)

	// TODO: document editors shouldn't construct their own tabbar
	// tab; that should be done by whoever constructed the tabbar,
	// if there is one, e.g. Freebase.Gui.
	
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
}; // DocumentEditor() constructor

com.qwirx.freebase.DocumentEditor.EDIT_AREA_RENDERER =
	goog.ui.ControlRenderer.getCustomRenderer(goog.ui.ControlRenderer,
		'fb-edit-area-doc-div');

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

/**
 * Event handler for global DocumentSaved events fired at the
 * database, which updates the grid if a document is modified or
 * created which the grid should display.
 */
com.qwirx.freebase.DocumentEditor.prototype.onDocumentSaved = function(event)
{
};

