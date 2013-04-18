goog.provide('com.qwirx.freebase.DocumentEditor');

goog.require('com.qwirx.freebase.ClosableTab');
goog.require('com.qwirx.ui.Renderer');
goog.require('goog.ui.Component');

com.qwirx.freebase.DocumentEditor = function(gui, freebase, document,
	opt_domHelper, opt_renderer)
{
	goog.ui.Component.call(this, opt_domHelper);
	
	this.renderer_ = opt_renderer || com.qwirx.freebase.DocumentEditor.RENDERER;

	this.gui_ = gui;
	this.freebase_ = freebase;
	this.document_ = document;
	this.documentId_ = (document ? document._id : null);
	var self = this;

	// Register a DocumentSaved event listener to update ourselves
	// if necessary, whenever a document is modified.

	goog.events.listen(freebase,
		com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this);
	
	// Subclasses should fill the editorControl with some controls :)
}; // DocumentEditor() constructor

goog.inherits(com.qwirx.freebase.DocumentEditor, goog.ui.Component);

com.qwirx.freebase.DocumentEditor.RENDERER =
	new com.qwirx.ui.Renderer(['fb-edit-area-doc-div']);

com.qwirx.freebase.DocumentEditor.prototype.createDom = function()
{
	var elem = this.renderer_.createDom(this);
	elem.style.height = "100%";
	elem.style.width = "100%";
	this.setElementInternal(elem);
};

com.qwirx.freebase.DocumentEditor.prototype.activate = function()
{
	this.getParentEventTarget().activate(this);
};

com.qwirx.freebase.DocumentEditor.prototype.onTabSelect = function(event)
{
	goog.style.showElement(this.getElement(), true);
};

com.qwirx.freebase.DocumentEditor.prototype.onTabUnselect = function(event)
{
	goog.style.showElement(this.getElement(), false);
};

com.qwirx.freebase.DocumentEditor.prototype.onTabClose = function(event)
{
	this.close();
};

com.qwirx.freebase.DocumentEditor.prototype.close = function()
{
	this.dispatchEvent(new com.qwirx.freebase.EditorClosed());	

	goog.asserts.assert(goog.events.unlisten(this.freebase_,
		com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this),
		"com.qwirx.freebase.DocumentEditor should have been listening " +
		"for DocumentSaved events, but was not.");
};

/**
 * Event handler for global DocumentSaved events fired at the
 * database, which updates the grid if a document is modified or
 * created which the grid should display.
 */
com.qwirx.freebase.DocumentEditor.prototype.onDocumentSaved = function(event)
{
};

/**
 * @return the title (string) which will be used by 
 * {@link com.qwirx.freebase.DocumentArea} for the tab that activates
 * or closes this document.
 */
com.qwirx.freebase.DocumentEditor.prototype.getTabTitle = function()
{
	return this.documentId_ || "Untitled";
};

com.qwirx.freebase.DocumentEvent = function(type, document)
{
	goog.base(this, type);
	this.document_ = document;
}

goog.inherits(com.qwirx.freebase.DocumentEvent, goog.events.Event);

com.qwirx.freebase.DocumentEvent.prototype.getDocument = function()
{
	return this.document_;
}

goog.provide('com.qwirx.freebase.DocumentSaved');
/**
 * An Event fired by a document editor at itself when a document is saved.
 * You can add a listener for this event on a Freebase to update your
 * GUI objects whenever an object is modified and saved.
 * @constructor
 */
com.qwirx.freebase.DocumentSaved = function(document)
{
	goog.base(this, com.qwirx.freebase.DocumentSaved.EVENT_TYPE, document);
}

goog.inherits(com.qwirx.freebase.DocumentSaved,
	com.qwirx.freebase.DocumentEvent);

com.qwirx.freebase.DocumentSaved.EVENT_TYPE =
	'com.qwirx.freebase.DocumentSaved';

goog.provide('com.qwirx.freebase.EditorClosed');
/**
 * An Event fired by a document editor at itself when a document is closed.
 * You can add a listener for this event on a Freebase to update your
 * GUI objects whenever an object is modified and saved.
 * @constructor
 */
com.qwirx.freebase.EditorClosed = function(document)
{
	goog.base(this, com.qwirx.freebase.EditorClosed.EVENT_TYPE, document);
}

goog.inherits(com.qwirx.freebase.EditorClosed, goog.events.Event);

com.qwirx.freebase.EditorClosed.EVENT_TYPE =
	'com.qwirx.freebase.EditorClosed';
