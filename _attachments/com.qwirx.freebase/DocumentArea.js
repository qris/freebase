goog.provide('com.qwirx.freebase.DocumentArea');

goog.require('goog.ui.Component');
goog.require('goog.ui.TabBar');

/**
 * A container for the document area, that sizes itself using HTML
 * tables to fill the entire space.
 *
 * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
 * @constructor
 * @extends {goog.ui.Component}
 */
com.qwirx.freebase.DocumentArea = function(opt_domHelper)
{
	goog.ui.Component.call(this, opt_domHelper);
	this.tabs_ = new goog.ui.TabBar();
	this.documentTabMap_ = {};
};
goog.inherits(com.qwirx.freebase.DocumentArea, goog.ui.Component);

/**
 * Creates the initial DOM representation for the component.
 */
com.qwirx.freebase.DocumentArea.prototype.createDom = function()
{
	var table = this.element_ = this.dom_.createDom('table',
		{'class': 'fb-doc-area-table'});

	var tabsRow = this.dom_.createDom('tr',
		{'class': 'fb-doc-area-tabs-row'});
	goog.dom.appendChild(table, tabsRow);
	var tabsCell = this.tabsCell_ = this.dom_.createDom('td',
		{'class': 'fb-doc-area-tabs-cell'});
	goog.dom.appendChild(tabsRow, tabsCell);

	var docRow = this.docRow_ = this.dom_.createDom('tr',
		{'class': 'fb-doc-area-doc-row'});
	goog.dom.appendChild(table, docRow);  
	var docCell = this.docCell_ = this.dom_.createDom('td',
		{'class': 'fb-doc-area-doc-cell'});
	goog.dom.appendChild(docRow, docCell);
	
	this.addChildAt(this.tabs_, 0 /* tab region */, true /* opt_render */);

	goog.events.listen(this, com.qwirx.freebase.EditorClosed.EVENT_TYPE,
		this.onEditorClosed, false, this);
};

com.qwirx.freebase.DocumentArea.prototype.addChildAt =
	function(child, index, opt_render)
{
	if (index == 0)
	{
		this.currentContentElement_ = this.getTabsCell();
	}
	else
	{
		this.currentContentElement_ = this.getDocCell();
	}

	goog.base(this, 'addChildAt', child, index, opt_render);
	delete this.currentContentElement_;
};

com.qwirx.freebase.DocumentArea.prototype.getContentElement = function() {
	return this.currentContentElement_;
};

/**
 * Returns the DOM element node for the tab bar portion of the document
 * area.
 */
com.qwirx.freebase.DocumentArea.prototype.getTabsCell = function()
{
	return this.tabsCell_;
};

/**
 * Returns the DOM element node for the document portion of the document
 * area.
 */
com.qwirx.freebase.DocumentArea.prototype.getDocCell = function()
{
	return this.docCell_;
};

/**
 * Adds a document editor to this DocumentArea, creating a tab for it
 * and binding events.
 */
com.qwirx.freebase.DocumentArea.prototype.addChild = function(editor,
	opt_render)
{
	goog.base(this, 'addChild', editor, opt_render);

	if (this.documentTabMap_[goog.getUid(editor)])
	{
		throw new com.qwirx.util.Exception("Tried to add a document " +
			"to this editor that's already open in the editor");
	}
	
	var title = editor.getTabTitle();
	var tab = new com.qwirx.freebase.ClosableTab(title);
	tab.setModel(editor);
	this.documentTabMap_[goog.getUid(editor)] = tab;

	this.tabs_.addChild(tab, opt_render);
	
	goog.events.listen(tab, goog.ui.Component.EventType.SELECT,
		editor.onTabSelect, false, editor);
	goog.events.listen(tab, goog.ui.Component.EventType.UNSELECT,
		editor.onTabUnselect, false, editor);
	goog.events.listen(tab, goog.ui.Component.EventType.CLOSE,
		editor.onTabClose, false, editor);		

	this.tabs_.setSelectedTab(tab);
};

com.qwirx.freebase.DocumentArea.prototype.onEditorClosed = function(event)
{
	var editor = event.target;
	var tab = this.documentTabMap_[goog.getUid(editor)];
	this.tabs_.removeChild(tab, true /* opt_unrender */);
	this.removeChild(editor, true /* opt_unrender */);
};

/**
 * Bring an already-open child tab to the foreground.
 */
com.qwirx.freebase.DocumentArea.prototype.activate = function(editor)
{
	var tab = this.documentTabMap_[goog.getUid(editor)];
	this.tabs_.setSelectedTab(tab);
};
