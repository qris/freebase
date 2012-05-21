goog.provide('com.qwirx.grid.NavigableGrid');

goog.require('com.qwirx.grid.Grid');

/**
 * A grid component with a built-in NavigationBar toolbar at the
 * bottom, linked to the grid's DataSource, which allows record
 * navigation.
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
	
	/*
	var table = this.element_ = this.dom_.createDom('table');

	var gridTr = this.dom_.createDom('tr');
	table.appendChild(gridTr);

	var gridTd = this.dom_.createDom('td');
	gridTr.appendChild(gridTd);
	// reparent the data grid
	gridTd.appendChild(this.dataTable_);

	var scrollTd = this.dom_.createDom('td');
	gridTr.appendChild(scrollTd);
	// reparent the scrollbar
	scrollTd.appendChild(this.scrollBar_.getElement());

	var navTr = this.dom_.createDom('tr');
	table.appendChild(navTr);

	var navTd = this.dom_.createDom('td');
	navTr.appendChild(navTd);
	this.nav_.render(navTd);
	*/
	
	// reparent existing elements into a scrollable viewport
	var children = goog.object.clone(goog.dom.getChildren(this.element_));
	goog.dom.removeChildren(this.element_);
	var scrollView = new goog.ui.Control(children);
	// scrollView.render(this.element_);
		/*
		this.dom_.createDom('div',
		'fb-navigablegrid-scrollview');
	var children = goog.dom.getChildren(this.element_);
	goog.dom.removeChildren(this.element_);
	goog.dom.append(scrollView., children);
	this.element_.appendChild(scrollView);
		*/
	
	this.nav_ = new com.qwirx.freebase.NavigationBar(this.dataSource_);
	// this.nav_.render(this.element_);
	
	// Set up splitpane with already existing DOM.
	this.splitter_ = new goog.ui.SplitPane(scrollView,
		this.nav_, goog.ui.SplitPane.Orientation.VERTICAL);
	this.splitter_.setInitialSize(100);
	this.appendChild(this.splitter_);

	com.qwirx.loader.loadCss('goog.closure', 'common.css',
		'toolbar.css');
};

