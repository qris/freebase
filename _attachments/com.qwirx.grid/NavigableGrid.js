goog.provide('com.qwirx.grid.NavigableGrid');

goog.require('com.qwirx.grid.Grid');
goog.require('com.qwirx.grid.NavigationBar');

/**
	@namespace
	@name com.qwirx.grid
*/

/**
 * A grid component with a built-in NavigationBar toolbar at the
 * bottom, linked to the grid's DataSource, which allows record
 * navigation.
 * @constructor
 */
com.qwirx.grid.NavigableGrid = function(datasource, opt_renderer)
{
	com.qwirx.grid.NavigableGrid.superClass_.constructor.call(this,
		datasource, opt_renderer);
};

goog.inherits(com.qwirx.grid.NavigableGrid, com.qwirx.grid.Grid);

/**
 * Allow Grid to construct its DOM, and then rearrange it to fit
 * into a table so that we can control element heights relative to
 * the container element.
 */
com.qwirx.grid.NavigableGrid.prototype.createDom = function()
{
	com.qwirx.grid.NavigableGrid.superClass_.createDom.call(this);
	this.addClassName('fb-navigablegrid');
		
	this.nav_ = new com.qwirx.grid.NavigationBar(this.cursor_);
	this.nav_.render(this.element_);
	
	com.qwirx.loader.loadCss('goog.closure', 'common.css',
		'toolbar.css');
};

/**
 * Add a bottom margin to the grid and the scrollbar, to make space
 * for the navigation bar, once we know its size.
 */
com.qwirx.grid.NavigableGrid.prototype.enterDocument = function()
{
	var parentHeight = this.getElement().clientHeight;
	var navBarHeight = this.nav_.getElement().clientHeight;
	var remainingHeight = parentHeight - navBarHeight;
	this.scrollBarOuterDiv_.style.height = remainingHeight + "px";
	this.dataDiv_.style.height = remainingHeight + "px";

	// Create the grid display rows, using the remaining space
	com.qwirx.grid.NavigableGrid.superClass_.enterDocument.call(this);
	
	this.nav_.setPageSize(this.getFullyVisibleRowCount());
};

