goog.provide('com.qwirx.grid.NavigationBar');
goog.provide('com.qwirx.grid.GridNavigationBar');

goog.require('com.qwirx.ui.ToolbarButton');
goog.require('com.qwirx.ui.TextField');

/**
 * A GUI component that can be placed at the bottom of a data viewer
 * component and used to navigate through the recordset, similar to
 * the arrows at the bottom of a form or datagrid in Access.
 * @constructor
 */
com.qwirx.grid.NavigationBar = function(cursor, opt_renderer,
	opt_domHelper)
{
	com.qwirx.grid.NavigationBar.superClass_.constructor.call(this,
		/* opt_renderer = */ opt_renderer ||
		com.qwirx.grid.NavigationBar.Renderer,
		/* opt_orientation = */ goog.ui.Container.Orientation.HORIZONTAL,
		opt_domHelper);
		
	this.cursor_ = cursor;
	
	goog.events.listen(cursor, com.qwirx.data.Cursor.Events.MOVE_TO,
		com.qwirx.grid.NavigationBar.prototype.onCursorMove, false, this);		
};

goog.inherits(com.qwirx.grid.NavigationBar, goog.ui.Toolbar);

/**
 * Override the prototype in {goog.ui.Container.prototype.handleMouseDown}
 * to avoid mouse events from buttons propagating up to the grid, where
 * they are most definitely not wanted.
 */
com.qwirx.grid.NavigationBar.prototype.handleMouseDown = function(e)
{
	e.stopPropagation();
};

/**
 * Override the prototype in {goog.ui.Container.prototype.handleMouseUp}
 * to avoid mouse events from buttons propagating up to the grid, where
 * they are most definitely not wanted.
 */
com.qwirx.grid.NavigationBar.prototype.handleMouseUp = function(e)
{
	e.stopPropagation();
};

com.qwirx.grid.NavigationBar.Renderer = 
	goog.ui.ToolbarRenderer.getInstance();
/*
	goog.ui.ContainerRenderer.getCustomRenderer(goog.ui.ToolbarRenderer,
		'fb-nav-bar');
*/

/**
 * Returns the number of rows that we move forward when the user
 * clicks on the Next Page button
 * {com#qwirx#grid#NavigationBar#nextPageButton_} or calls 
 * {com#qwirx#grid#NavigationBar#onNextPageButton}.
 */
com.qwirx.grid.NavigationBar.prototype.getPageSize = function()
{
	return this.pageSize_;
};

/**
 * Sets the number of rows that we move forward when the user
 * clicks on the Next Page button
 * {com#qwirx#grid#NavigationBar#nextPageButton_} or calls 
 * {com#qwirx#grid#NavigationBar#onNextPageButton}.
 */
com.qwirx.grid.NavigationBar.prototype.setPageSize = function(newPageSize)
{
	this.pageSize_ = newPageSize;
};

/**
 * Returns the Cursor underlying this {com.qwirx.grid.NavigationBar}.
 * This allows you to perform navigation actions directly on the
 * cursor. They should be reflected in this NavigationBar, except for
 * bugs, but calling this method voids your warranty!
 */
com.qwirx.grid.NavigationBar.prototype.getCursor = function()
{
	return this.cursor_;
};

com.qwirx.grid.NavigationBar.prototype.createDom = function(tab)
{
	var element = 
		com.qwirx.grid.NavigationBar.superClass_.createDom.call(this,
		tab);

	this.firstButton_ = new com.qwirx.ui.ToolbarButton('\u21E4' /* left arrow to bar */);
	this.firstButton_.render(this.getElement());
	goog.events.listen(this.firstButton_,
		goog.ui.Component.EventType.ACTION,
		this.onFirstButton, false, this);

	this.prevPageButton_ = new com.qwirx.ui.ToolbarButton('\u219E' /* double left arrow */);
	this.prevPageButton_.render(this.getElement());
	goog.events.listen(this.prevPageButton_,
		goog.ui.Component.EventType.ACTION,
		this.onPrevPageButton, false, this);

	this.prevButton_ = new com.qwirx.ui.ToolbarButton('\u2190' /* single left arrow */);
	this.prevButton_.render(this.getElement());
	goog.events.listen(this.prevButton_,
		goog.ui.Component.EventType.ACTION,
		this.onPrevButton, false, this);
		
	this.rowNumberField_ = new com.qwirx.ui.TextField('1');
	this.rowNumberField_.render(this.getElement());
	goog.events.listen(this.rowNumberField_,
		goog.ui.Component.EventType.ACTION,
		this.onRowNumberChange, false, this);

	this.nextButton_ = new com.qwirx.ui.ToolbarButton('\u2192' /* single right arrow */);
	this.nextButton_.render(this.getElement());
	goog.events.listen(this.nextButton_,
		goog.ui.Component.EventType.ACTION,
		this.onNextButton, false, this);

	this.nextPageButton_ = new com.qwirx.ui.ToolbarButton('\u21A0' /* double right arrow */);
	this.nextPageButton_.render(this.getElement());
	goog.events.listen(this.nextPageButton_,
		goog.ui.Component.EventType.ACTION,
		this.onNextPageButton, false, this);

	this.lastButton_ = new com.qwirx.ui.ToolbarButton('\u21E5' /* right arrow to bar */);
	this.lastButton_.render(this.getElement());
	goog.events.listen(this.lastButton_,
		goog.ui.Component.EventType.ACTION,
		this.onLastButton, false, this);
        
	return element;
};

com.qwirx.grid.NavigationBar.prototype.onFirstButton = function(event)
{
	this.cursor_.moveFirst();	
};

com.qwirx.grid.NavigationBar.prototype.onPrevPageButton = function(event)
{
	this.cursor_.moveBackward(this.pageSize_);	
};

com.qwirx.grid.NavigationBar.prototype.onPrevButton = function(event)
{
	this.cursor_.moveBackward(1);	
};

com.qwirx.grid.NavigationBar.prototype.onRowNumberChange = function(event)
{
	
};

com.qwirx.grid.NavigationBar.prototype.onNextButton = function(event)
{
	this.cursor_.moveForward(1);
};

com.qwirx.grid.NavigationBar.prototype.onNextPageButton = function(event)
{
	this.cursor_.moveForward(this.pageSize_);
};

com.qwirx.grid.NavigationBar.prototype.onLastButton = function(event)
{
	this.cursor_.moveLast();
};

/**
 * Responds to events fired by the cursor underlying this
 * {com.qwirx.grid.NavigationBar} by updating the position box
 * value and enabling or disabling navigation buttons.
 * @private
 */
com.qwirx.grid.NavigationBar.prototype.onCursorMove = function(event)
{
	this.rowNumberField_.setValue(this.cursor_.getPosition());
};

com.qwirx.grid.GridNavigationBar = function(cursor, opt_renderer,
	opt_domHelper)
{
	com.qwirx.grid.GridNavigationBar.superClass_.constructor.call(this,
		cursor, opt_renderer, opt_domHelper);
};

goog.inherits(com.qwirx.grid.GridNavigationBar,
	com.qwirx.grid.NavigationBar);

