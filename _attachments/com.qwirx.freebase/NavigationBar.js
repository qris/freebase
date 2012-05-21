goog.provide('com.qwirx.freebase.NavigationBar');

goog.require('goog.ui.ToolbarButton');

com.qwirx.freebase.NavigationBar = function(dataSource, opt_renderer,
	opt_domHelper)
{
	com.qwirx.freebase.NavigationBar.superClass_.constructor.call(this,
		/* opt_renderer = */ opt_renderer ||
		com.qwirx.freebase.NavigationBar.Renderer,
		/* opt_orientation = */ goog.ui.Container.Orientation.HORIZONTAL,
		opt_domHelper);
		
	this.dataSource_ = dataSource;
};

goog.inherits(com.qwirx.freebase.NavigationBar, goog.ui.Toolbar);

com.qwirx.freebase.NavigationBar.Renderer = 
	goog.ui.ToolbarRenderer.getInstance();
/*
	goog.ui.ContainerRenderer.getCustomRenderer(goog.ui.ToolbarRenderer,
		'fb-nav-bar');
*/

com.qwirx.freebase.NavigationBar.prototype.createDom = function(tab)
{
	var element = 
		com.qwirx.freebase.NavigationBar.superClass_.createDom.call(this,
		tab);

	this.firstButton_ = new goog.ui.ToolbarButton('\u00AB' /* double left arrow */);
	this.firstButton_.render(this.getElement());
	goog.events.listen(this.firstButton_,
		goog.ui.Component.EventType.ACTION,
		this.onFirstButton, false, this);

	this.prevButton_ = new goog.ui.ToolbarButton('\u2039' /* single left arrow */);
	this.prevButton_.render(this.getElement());
	goog.events.listen(this.prevButton_,
		goog.ui.Component.EventType.ACTION,
		this.onPrevButton, false, this);

	this.nextButton_ = new goog.ui.ToolbarButton('\u203A' /* single right arrow */);
	this.nextButton_.render(this.getElement());
	goog.events.listen(this.nextButton_,
		goog.ui.Component.EventType.ACTION,
		this.onNextButton, false, this);

	this.lastButton_ = new goog.ui.ToolbarButton('\u00BB' /* double right arrow */);
	this.lastButton_.render(this.getElement());
	goog.events.listen(this.lastButton_,
		goog.ui.Component.EventType.ACTION,
		this.onLastButton, false, this);
        
	return element;
};

com.qwirx.freebase.NavigationBar.prototype.onFirstButton = function(event)
{
	
};

com.qwirx.freebase.NavigationBar.prototype.onPrevButton = function(event)
{
	
};

com.qwirx.freebase.NavigationBar.prototype.onNextButton = function(event)
{
	
};

com.qwirx.freebase.NavigationBar.prototype.onLastButton = function(event)
{
	
};

