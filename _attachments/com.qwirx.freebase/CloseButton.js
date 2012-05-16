goog.provide('com.qwirx.freebase.CloseButton');

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

