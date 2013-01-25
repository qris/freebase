goog.provide('com.qwirx.freebase.DocumentArea');

goog.require('goog.ui.Component');

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
};

/**
 * Returns the DOM element node for the tab bar portion of the document
 * area.
 */
com.qwirx.freebase.DocumentArea.prototype.getTabsCell = function()
{
	return this.tabsCell_;
}

/**
 * Returns the DOM element node for the document portion of the document
 * area.
 */
com.qwirx.freebase.DocumentArea.prototype.getDocCell = function()
{
	return this.docCell_;
}

